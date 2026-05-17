#!/usr/bin/env python3
"""GraphSentinel ML service.

This service uses TensorFlow to train and run a temporal graph + sequence model
for fraud pattern inference. The Node backend calls /analyze for scoring and
/retrain for model refreshes.
"""

from __future__ import annotations

import json
import math
import os
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import tensorflow as tf
from http.server import BaseHTTPRequestHandler, HTTPServer
from datetime import datetime, timezone


ARTIFACT_DIR = Path(__file__).resolve().parent / "ml_artifacts"
MODEL_PATH = ARTIFACT_DIR / "graphsentinel_model.keras"
META_PATH = ARTIFACT_DIR / "graphsentinel_meta.json"

SEQ_LEN = 24
GRAPH_STEPS = 10
SEQ_FEATURES = 11   # log_amt, raw_amt, direction, time_gap, 5×channel_onehot, risk_score, acct_age
GRAPH_FEATURES = 8
CLASS_NAMES = [
    "normal",
    "multi_hop_layering",
    "circular_round_trip",
    "structuring",
    "dormant_reactivation",
    "kyc_mismatch",
    "fan_out_fan_in",
    "velocity_spike",
    "cross_border_layering",
]
CLASS_TO_INDEX = {name: index for index, name in enumerate(CLASS_NAMES)}

SEQ_FEATURE_NAMES = [
    "Transaction log-amount",
    "Transaction raw amount",
    "Send/receive direction",
    "Inter-transaction time gap",
    "Channel: NEFT",
    "Channel: RTGS",
    "Channel: UPI",
    "Channel: CORE",
    "Channel: OTHER",
    "Account risk score",
    "Account age (years)",
]
GRAPH_FEATURE_NAMES = [
    "Total flow volume",
    "Transaction count",
    "Unique senders",
    "Unique receivers",
    "High-risk account ratio",
    "Sub-threshold ratio",
    "Dormant account ratio",
    "Network density",
]
REPORTING_THRESHOLD = 1_000_000
PORT = int(os.getenv("ML_PORT", "8790"))

ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def round_score(value: float) -> float:
    return round(clamp(value, 0.0, 0.99), 2)


def days_between(start: str, end: str | None = None) -> float:
    end_value = parse_iso(end) if end else datetime.now(timezone.utc)
    return abs((end_value - parse_iso(start)).total_seconds()) / 86_400.0


def hours_between(start: str, end: str) -> float:
    return abs((parse_iso(end) - parse_iso(start)).total_seconds()) / 3_600.0


def transaction_channel_index(channel: str) -> int:
    value = (channel or "").upper()
    return {"NEFT": 0, "RTGS": 1, "UPI": 2, "CORE": 3}.get(value, 4)


def one_hot(index: int, size: int) -> list[float]:
    vector = [0.0] * size
    if 0 <= index < size:
        vector[index] = 1.0
    return vector


def load_meta() -> dict[str, Any]:
    if META_PATH.exists():
        return json.loads(META_PATH.read_text())
    return {
        "seq_mean": [0.0] * SEQ_FEATURES,
        "seq_std": [1.0] * SEQ_FEATURES,
        "graph_mean": [0.0] * GRAPH_FEATURES,
        "graph_std": [1.0] * GRAPH_FEATURES,
        "version": "untrained",
    }


def save_meta(meta: dict[str, Any]) -> None:
    META_PATH.write_text(json.dumps(meta, indent=2))


def normalize_matrix(matrix: np.ndarray, mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    return (matrix - mean) / np.where(std == 0, 1.0, std)


def severity_from_score(confidence: float, total_amount: float) -> str:
    if confidence >= 0.9 or total_amount >= 50_000_000:
        return "critical"
    if confidence >= 0.78 or total_amount >= 10_000_000:
        return "high"
    if confidence >= 0.62 or total_amount >= 1_000_000:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# New-pattern heuristic detectors
# ---------------------------------------------------------------------------

def _detect_fan_out_fan_in(account_id: str, transactions: list[dict]) -> bool:
    """One source → many destinations (fan-out) or many sources → one (fan-in)."""
    recent = sorted(
        [t for t in transactions
         if t["sender_account_id"] == account_id or t["receiver_account_id"] == account_id],
        key=lambda t: t["timestamp"],
    )[-40:]
    if len(recent) < 6:
        return False
    senders = {t["sender_account_id"] for t in recent if t["receiver_account_id"] == account_id}
    receivers = {t["receiver_account_id"] for t in recent if t["sender_account_id"] == account_id}
    return (len(senders) <= 2 and len(receivers) >= 5) or (len(senders) >= 5 and len(receivers) <= 2)


def _detect_velocity_spike(account_id: str, transactions: list[dict]) -> bool:
    """Recent send-frequency >3× the rolling baseline."""
    sent = sorted(
        [t for t in transactions if t["sender_account_id"] == account_id],
        key=lambda t: t["timestamp"],
    )
    if len(sent) < 12:
        return False
    latest = parse_iso(sent[-1]["timestamp"])
    earliest = parse_iso(sent[0]["timestamp"])
    total_days = max((latest - earliest).total_seconds() / 86_400.0, 14.0)
    avg_per_7 = len(sent) * 7.0 / total_days
    last_7 = sum(
        1 for t in sent
        if (latest - parse_iso(t["timestamp"])).total_seconds() / 86_400.0 <= 7
    )
    return last_7 >= 8 and last_7 > 3.0 * avg_per_7


def _detect_cross_border(account_id: str, transactions: list[dict], account_map: dict) -> bool:
    """Transactions span ≥4 distinct city-prefixes across involved accounts."""
    involved = {t["sender_account_id"] for t in transactions if t["receiver_account_id"] == account_id}
    involved |= {t["receiver_account_id"] for t in transactions if t["sender_account_id"] == account_id}
    involved.add(account_id)
    cities: set[str] = set()
    for aid in involved:
        branch = account_map.get(aid, {}).get("bank_branch", "")
        city = (branch or "").split()[0]
        if city:
            cities.add(city)
    return len(cities) >= 4



class EvolveGCNBlock(tf.keras.layers.Layer):
    def __init__(self, units: int, steps: int, **kwargs):
        super().__init__(**kwargs)
        self.units = units
        self.steps = steps
        self.step_projection = tf.keras.layers.Dense(units, activation="relu")
        self.evolver = tf.keras.layers.GRUCell(units)

    def call(self, inputs: tf.Tensor) -> tf.Tensor:
        batch_size = tf.shape(inputs)[0]
        state = tf.zeros((batch_size, self.units), dtype=inputs.dtype)
        states: list[tf.Tensor] = []

        for step in range(self.steps):
            x = inputs[:, step, :]
            x = self.step_projection(x)
            output, [state] = self.evolver(x, [state])
            states.append(output)

        stacked = tf.stack(states, axis=1)
        pooled = tf.concat([stacked[:, -1, :], tf.reduce_mean(stacked, axis=1)], axis=-1)
        return pooled


def build_model() -> tf.keras.Model:
    graph_input = tf.keras.Input(shape=(GRAPH_STEPS, GRAPH_FEATURES), name="graph_input")
    seq_input = tf.keras.Input(shape=(SEQ_LEN, SEQ_FEATURES), name="seq_input")

    graph_embed = EvolveGCNBlock(32, GRAPH_STEPS, name="evolve_gcn")(graph_input)
    seq_encoded = tf.keras.layers.LSTM(64, return_sequences=True, name="seq_encoder_1")(seq_input)
    seq_encoded = tf.keras.layers.LSTM(32, name="seq_encoder_2")(seq_encoded)

    combined = tf.keras.layers.Concatenate(name="fusion")([graph_embed, seq_encoded])
    combined = tf.keras.layers.Dense(64, activation="relu", name="fusion_dense_1")(combined)
    combined = tf.keras.layers.Dropout(0.15, name="fusion_dropout")(combined)

    class_output = tf.keras.layers.Dense(len(CLASS_NAMES), activation="softmax", name="class_output")(combined)

    reconstruction = tf.keras.layers.RepeatVector(SEQ_LEN, name="repeat_latent")(seq_encoded)
    reconstruction = tf.keras.layers.LSTM(32, return_sequences=True, name="recon_lstm")(reconstruction)
    reconstruction = tf.keras.layers.TimeDistributed(tf.keras.layers.Dense(SEQ_FEATURES), name="recon_output")(reconstruction)

    model = tf.keras.Model(inputs=[graph_input, seq_input], outputs=[class_output, reconstruction], name="graphsentinel_model")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss={"class_output": "sparse_categorical_crossentropy", "recon_output": "mse"},
        loss_weights={"class_output": 1.0, "recon_output": 0.35},
        metrics={"class_output": ["accuracy"]},
    )
    return model


def load_model_if_available() -> tf.keras.Model | None:
    if not MODEL_PATH.exists():
        return None
    return tf.keras.models.load_model(MODEL_PATH, custom_objects={"EvolveGCNBlock": EvolveGCNBlock})


def build_account_sequences(accounts: list[dict], transactions: list[dict]) -> dict[str, list[dict]]:
    by_account: dict[str, list[dict]] = defaultdict(list)
    for transaction in transactions:
        by_account[transaction["sender_account_id"]].append({**transaction, "direction": 1.0})
        by_account[transaction["receiver_account_id"]].append({**transaction, "direction": -1.0})

    for account_id in by_account:
        by_account[account_id].sort(key=lambda item: item["timestamp"])

    for account in accounts:
        by_account.setdefault(account["id"], [])

    return by_account


def build_graph_snapshots(accounts: list[dict], transactions: list[dict], steps: int = GRAPH_STEPS) -> np.ndarray:
    if not transactions:
        return np.zeros((steps, GRAPH_FEATURES), dtype=np.float32)

    latest = max(parse_iso(transaction["timestamp"]) for transaction in transactions)
    earliest = min(parse_iso(transaction["timestamp"]) for transaction in transactions)
    total_seconds = max((latest - earliest).total_seconds(), 1.0)
    bucket_seconds = total_seconds / steps

    account_map = {account["id"]: account for account in accounts}
    snapshots: list[list[float]] = []

    for step in range(steps):
        start = earliest.timestamp() + bucket_seconds * step
        end = earliest.timestamp() + bucket_seconds * (step + 1)
        bucket = [transaction for transaction in transactions if start <= parse_iso(transaction["timestamp"]).timestamp() < end]

        total_amount = sum(safe_float(transaction["amount"]) for transaction in bucket)
        txn_count = len(bucket)
        unique_senders = len({transaction["sender_account_id"] for transaction in bucket})
        unique_receivers = len({transaction["receiver_account_id"] for transaction in bucket})
        high_risk_ratio = 0.0
        if bucket:
            risky_accounts = {
                transaction["sender_account_id"]
                for transaction in bucket
                if account_map.get(transaction["sender_account_id"], {}).get("risk_level") in {"high", "critical"}
            }
            high_risk_ratio = len(risky_accounts) / max(unique_senders, 1)

        sub_threshold_ratio = 0.0
        if bucket:
            sub_threshold_ratio = sum(
                1 for transaction in bucket if REPORTING_THRESHOLD * 0.88 <= safe_float(transaction["amount"]) < REPORTING_THRESHOLD
            ) / len(bucket)

        dormant_ratio = 0.0
        if bucket:
            dormant_ratio = sum(
                1 for transaction in bucket if account_map.get(transaction["sender_account_id"], {}).get("is_dormant")
            ) / len(bucket)

        network_density = txn_count / max(unique_senders * unique_receivers, 1)
        snapshots.append([
            total_amount / 1_000_000.0,
            txn_count / 10.0,
            unique_senders / 10.0,
            unique_receivers / 10.0,
            high_risk_ratio,
            sub_threshold_ratio,
            dormant_ratio,
            network_density,
        ])

    return np.asarray(snapshots, dtype=np.float32)


def build_sequence_features(account: dict, transactions: list[dict], seq_len: int = SEQ_LEN) -> tuple[np.ndarray, list[str]]:
    relevant = [
        transaction
        for transaction in transactions
        if transaction["sender_account_id"] == account["id"] or transaction["receiver_account_id"] == account["id"]
    ]
    relevant.sort(key=lambda item: item["timestamp"])

    if not relevant:
        return np.zeros((seq_len, SEQ_FEATURES), dtype=np.float32), []

    account_created = account.get("created_at") or relevant[0]["timestamp"]
    rows: list[list[float]] = []
    transaction_ids: list[str] = []
    previous_timestamp = parse_iso(relevant[0]["timestamp"])

    for transaction in relevant[-seq_len:]:
        current_timestamp = parse_iso(transaction["timestamp"])
        hours_gap = (current_timestamp - previous_timestamp).total_seconds() / 3600.0
        if hours_gap < 0:
            hours_gap = 0.0
        direction = 1.0 if transaction["sender_account_id"] == account["id"] else -1.0
        amount = safe_float(transaction["amount"])
        age_days = days_between(account_created, transaction["timestamp"]) / 365.0

        rows.append([
            math.log1p(amount) / 16.0,
            amount / 10_000_000.0,
            direction,
            hours_gap / 24.0,
            *one_hot(transaction_channel_index(transaction.get("channel", "")), 5),
            safe_float(account.get("risk_score"), 0.0) / 100.0,
            age_days,
        ])
        transaction_ids.append(transaction["id"])
        previous_timestamp = current_timestamp

    if len(rows) < seq_len:
        pad = [[0.0] * SEQ_FEATURES for _ in range(seq_len - len(rows))]
        rows = pad + rows

    return np.asarray(rows[-seq_len:], dtype=np.float32), transaction_ids[-seq_len:]


def build_labels(accounts: list[dict], alerts: list[dict], feedback: list[dict],
                 transactions: list[dict] | None = None) -> dict[str, int]:
    account_labels = {account["id"]: CLASS_TO_INDEX["normal"] for account in accounts}
    feedback_by_alert = {item.get("alert_id"): item for item in feedback if item.get("alert_id")}
    account_map = {a["id"]: a for a in accounts}
    txns = transactions or []

    priority = {name: index for index, name in enumerate(CLASS_NAMES)}
    for alert in alerts:
        label_name = alert.get("pattern_type", "normal")
        if label_name not in CLASS_TO_INDEX:
            label_name = "normal"

        fb = feedback_by_alert.get(alert["id"])
        if fb and fb.get("investigator_action") == "dismissed":
            label_name = "normal"

        candidate = CLASS_TO_INDEX[label_name]
        for account_id in alert.get("involved_accounts", []):
            existing = account_labels.get(account_id, 0)
            if candidate >= existing and priority[CLASS_NAMES[candidate]] >= priority[CLASS_NAMES[existing]]:
                account_labels[account_id] = candidate

    # Heuristic auto-labelling for new pattern types (only when not already flagged)
    if txns:
        for account in accounts:
            aid = account["id"]
            if account_labels[aid] != CLASS_TO_INDEX["normal"]:
                continue  # already has a label from an alert
            if _detect_fan_out_fan_in(aid, txns):
                account_labels[aid] = CLASS_TO_INDEX["fan_out_fan_in"]
            elif _detect_velocity_spike(aid, txns):
                account_labels[aid] = CLASS_TO_INDEX["velocity_spike"]
            elif _detect_cross_border(aid, txns, account_map):
                account_labels[aid] = CLASS_TO_INDEX["cross_border_layering"]

    return account_labels


def build_training_dataset(payload: dict[str, Any]) -> dict[str, Any]:
    accounts = payload.get("accounts", []) or []
    transactions = payload.get("transactions", []) or []
    alerts = payload.get("alerts", []) or []
    feedback = payload.get("feedback", []) or []

    graph_context = build_graph_snapshots(accounts, transactions)
    labels = build_labels(accounts, alerts, feedback, transactions)

    seq_vectors: list[np.ndarray] = []
    graph_vectors: list[np.ndarray] = []
    y: list[int] = []
    sequence_meta: list[dict[str, Any]] = []

    for account in accounts:
        seq_matrix, txn_ids = build_sequence_features(account, transactions)
        seq_vectors.append(seq_matrix)
        graph_vectors.append(graph_context)
        y.append(labels.get(account["id"], 0))
        sequence_meta.append({
            "account_id": account["id"],
            "holder_name": account.get("holder_name", account["id"]),
            "transaction_ids": txn_ids,
            "risk_score": safe_float(account.get("risk_score")),
            "risk_level": account.get("risk_level", "low"),
            "declared_income": safe_float(account.get("declared_annual_income")),
            "is_dormant": bool(account.get("is_dormant", False)),
            "bank_branch": account.get("bank_branch", "Unknown"),
        })

    seq_array = np.stack(seq_vectors, axis=0).astype(np.float32)
    graph_array = np.stack(graph_vectors, axis=0).astype(np.float32)
    y_array = np.asarray(y, dtype=np.int32)

    seq_mean = seq_array.reshape(-1, SEQ_FEATURES).mean(axis=0)
    seq_std = seq_array.reshape(-1, SEQ_FEATURES).std(axis=0)
    graph_mean = graph_array.reshape(-1, GRAPH_FEATURES).mean(axis=0)
    graph_std = graph_array.reshape(-1, GRAPH_FEATURES).std(axis=0)

    seq_array = normalize_matrix(seq_array, seq_mean, seq_std)
    graph_array = normalize_matrix(graph_array, graph_mean, graph_std)

    return {
        "accounts": accounts,
        "transactions": transactions,
        "alerts": alerts,
        "feedback": feedback,
        "sequence_meta": sequence_meta,
        "seq_array": seq_array,
        "graph_array": graph_array,
        "y_array": y_array,
        "seq_mean": seq_mean.astype(np.float32),
        "seq_std": seq_std.astype(np.float32),
        "graph_mean": graph_mean.astype(np.float32),
        "graph_std": graph_std.astype(np.float32),
    }


def build_model() -> tf.keras.Model:
    graph_input = tf.keras.Input(shape=(GRAPH_STEPS, GRAPH_FEATURES), name="graph_input")
    seq_input = tf.keras.Input(shape=(SEQ_LEN, SEQ_FEATURES), name="seq_input")

    graph_embed = EvolveGCNBlock(32, GRAPH_STEPS, name="evolve_gcn")(graph_input)
    seq_encoded = tf.keras.layers.LSTM(64, return_sequences=True, name="seq_encoder_1")(seq_input)
    seq_encoded = tf.keras.layers.LSTM(32, name="seq_encoder_2")(seq_encoded)

    combined = tf.keras.layers.Concatenate(name="fusion")([graph_embed, seq_encoded])
    combined = tf.keras.layers.Dense(64, activation="relu", name="fusion_dense_1")(combined)
    combined = tf.keras.layers.Dropout(0.15, name="fusion_dropout")(combined)

    class_output = tf.keras.layers.Dense(len(CLASS_NAMES), activation="softmax", name="class_output")(combined)

    reconstruction = tf.keras.layers.RepeatVector(SEQ_LEN, name="repeat_latent")(seq_encoded)
    reconstruction = tf.keras.layers.LSTM(32, return_sequences=True, name="recon_lstm")(reconstruction)
    reconstruction = tf.keras.layers.TimeDistributed(tf.keras.layers.Dense(SEQ_FEATURES), name="recon_output")(reconstruction)

    model = tf.keras.Model(inputs=[graph_input, seq_input], outputs=[class_output, reconstruction], name="graphsentinel_model")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss={"class_output": "sparse_categorical_crossentropy", "recon_output": "mse"},
        loss_weights={"class_output": 1.0, "recon_output": 0.35},
        metrics={"class_output": ["accuracy"]},
    )
    return model


def load_model_if_available() -> tf.keras.Model | None:
    if not MODEL_PATH.exists():
        return None
    return tf.keras.models.load_model(MODEL_PATH, custom_objects={"EvolveGCNBlock": EvolveGCNBlock})


def train_model(payload: dict[str, Any]) -> dict[str, Any]:
    dataset = build_training_dataset(payload)
    seq_array = dataset["seq_array"]
    graph_array = dataset["graph_array"]
    y_array = dataset["y_array"]

    if len(y_array) == 0:
        return {"ok": True, "model": "graphsentinel-temporal-graph-lstm", "trained_samples": 0, "epochs": 0, "version": "no-data"}

    model = build_model()
    sample_weights = np.ones(len(y_array), dtype=np.float32)
    feedback = dataset.get("feedback", []) or []
    feedback_by_alert = {item.get("alert_id"): item for item in feedback if item.get("alert_id")}

    for index, meta in enumerate(dataset["sequence_meta"]):
        for alert in dataset["alerts"]:
            if meta["account_id"] in alert.get("involved_accounts", []):
                fb = feedback_by_alert.get(alert["id"])
                if fb:
                    if fb.get("investigator_action") == "confirmed":
                        sample_weights[index] = 1.5
                    elif fb.get("investigator_action") == "dismissed":
                        sample_weights[index] = 0.7

    epochs = int(payload.get("epochs", 5))
    history = model.fit(
        [graph_array, seq_array],
        [y_array, seq_array],
        epochs=epochs,
        batch_size=min(16, len(y_array)),
        verbose=0,
        sample_weight=[sample_weights, None],
        validation_split=0.15 if len(y_array) > 8 else 0.0,
    )

    version = utc_now()
    model.save(MODEL_PATH)
    save_meta({
        "seq_mean": dataset["seq_mean"].tolist(),
        "seq_std": dataset["seq_std"].tolist(),
        "graph_mean": dataset["graph_mean"].tolist(),
        "graph_std": dataset["graph_std"].tolist(),
        "version": version,
    })

    return {
        "ok": True,
        "model": "graphsentinel-temporal-graph-lstm",
        "trained_samples": int(len(y_array)),
        "epochs": epochs,
        "version": version,
        "history": {key: [float(v) for v in values] for key, values in history.history.items()},
    }


def ensure_model(payload: dict[str, Any]) -> tuple[tf.keras.Model, dict[str, Any]]:
    meta = load_meta()
    model = load_model_if_available()
    if model is None:
        train_model({**payload, "epochs": int(payload.get("epochs", 4))})
        meta = load_meta()
        model = load_model_if_available()
    if model is None:
        raise RuntimeError("Unable to load GraphSentinel TensorFlow model")
    return model, meta


def narrative_for_pattern(pattern: str, account_meta: dict[str, Any], stats: dict[str, float], confidence: float) -> str:
    pattern_desc = {
        "fan_out_fan_in": "fan-out/fan-in consolidation",
        "velocity_spike": "velocity spike",
        "cross_border_layering": "cross-border layering",
    }.get(pattern, pattern.replace('_', ' '))
    return (
        f"TensorFlow model predicted {pattern_desc} with {confidence * 100:.1f}% confidence for "
        f"{account_meta['holder_name']}. Top attributions: {stats.get('top_factor', 'transaction volume')} "
        f"(IG weight {stats.get('top_weight', 0.0):.2f}), "
        f"sequence volatility {stats['gap_score']:.2f}, graph pressure {stats['graph_score']:.2f}."
    )


# ---------------------------------------------------------------------------
# Integrated Gradients — true feature attribution replacing heuristic weights
# ---------------------------------------------------------------------------

def compute_integrated_gradients(
    model: tf.keras.Model,
    seq_input: np.ndarray,   # shape (1, SEQ_LEN, SEQ_FEATURES)
    graph_input: np.ndarray, # shape (1, GRAPH_STEPS, GRAPH_FEATURES)
    class_index: int,
    steps: int = 20,
) -> tuple[np.ndarray, np.ndarray]:
    """Return per-feature attributions for the classification head via IG."""
    baseline_seq = np.zeros_like(seq_input, dtype=np.float32)
    baseline_graph = np.zeros_like(graph_input, dtype=np.float32)

    alpha_seq   = np.linspace(0.0, 1.0, steps + 1, dtype=np.float32)
    seq_interp  = baseline_seq + alpha_seq[:, None, None] * (seq_input - baseline_seq)
    graph_interp = baseline_graph + alpha_seq[:, None, None] * (graph_input - baseline_graph)

    all_gs, all_gg = [], []
    for i in range(steps + 1):
        s = tf.constant(seq_interp[i : i + 1])
        g = tf.constant(graph_interp[i : i + 1])
        with tf.GradientTape() as tape:
            tape.watch([s, g])
            preds, _ = model([g, s], training=False)
            target = preds[0, class_index]
        gs, gg = tape.gradient(target, [s, g])
        all_gs.append(gs.numpy()[0])
        all_gg.append(gg.numpy()[0])

    avg_gs = np.mean(all_gs, axis=0)   # (SEQ_LEN, SEQ_FEATURES)
    avg_gg = np.mean(all_gg, axis=0)   # (GRAPH_STEPS, GRAPH_FEATURES)

    ig_seq   = (seq_input[0]   - baseline_seq[0])   * avg_gs
    ig_graph = (graph_input[0] - baseline_graph[0]) * avg_gg
    return ig_seq, ig_graph


def explain_factors_ig(
    model: tf.keras.Model,
    seq_input: np.ndarray,
    graph_input: np.ndarray,
    class_index: int,
) -> tuple[list[dict[str, Any]], dict[str, float]]:
    """Compute IG-based SHAP-equivalent factors for the alert card."""
    try:
        ig_seq, ig_graph = compute_integrated_gradients(
            model, seq_input, graph_input, class_index
        )
        # Aggregate over time dimension → per-feature mean absolute attribution
        seq_importance   = np.abs(ig_seq).mean(axis=0)    # (SEQ_FEATURES,)
        graph_importance = np.abs(ig_graph).mean(axis=0)  # (GRAPH_FEATURES,)

        all_factors: list[tuple[str, float]] = [
            *zip(SEQ_FEATURE_NAMES,   seq_importance.tolist()),
            *zip(GRAPH_FEATURE_NAMES, graph_importance.tolist()),
        ]
        total = sum(w for _, w in all_factors) or 1.0
        all_factors_norm = [(f, w / total) for f, w in all_factors]
        all_factors_norm.sort(key=lambda x: x[1], reverse=True)

        top_factor, top_weight = all_factors_norm[0]
        shap_factors = [
            {"factor": f, "weight": round(w, 3), "direction": "increases_risk"}
            for f, w in all_factors_norm[:6]   # top-6 in alert card
        ]
        stats_extra = {
            "top_factor": top_factor,
            "top_weight": round(top_weight, 3),
            "gap_score":  float(np.std(ig_seq[:, 3])) if ig_seq.shape[1] > 3 else 0.0,
            "graph_score": float(graph_importance[:4].mean()),
        }
        return shap_factors, stats_extra
    except Exception:  # pragma: no cover — fallback if GradientTape fails
        return [], {"top_factor": "transaction volume", "top_weight": 0.0,
                    "gap_score": 0.0, "graph_score": 0.0}


def infer_alerts(payload: dict[str, Any]) -> dict[str, Any]:
    model, meta = ensure_model(payload)

    accounts = payload.get("accounts", []) or []
    transactions = payload.get("transactions", []) or []
    alerts = payload.get("alerts", []) or []
    feedback = payload.get("feedback", []) or []

    dataset = build_training_dataset({"accounts": accounts, "transactions": transactions, "alerts": alerts, "feedback": feedback})

    seq_array = normalize_matrix(dataset["seq_array"], np.asarray(meta["seq_mean"], dtype=np.float32), np.asarray(meta["seq_std"], dtype=np.float32))
    graph_array = normalize_matrix(dataset["graph_array"], np.asarray(meta["graph_mean"], dtype=np.float32), np.asarray(meta["graph_std"], dtype=np.float32))

    class_probs, reconstructed = model.predict([graph_array, seq_array], verbose=0)
    reconstruction_error = np.mean(np.square(seq_array - reconstructed), axis=(1, 2))

    predictions: list[dict[str, Any]] = []
    for index, account in enumerate(accounts):
        probabilities = class_probs[index]
        class_index = int(np.argmax(probabilities))
        confidence = float(probabilities[class_index])
        anomaly = float(reconstruction_error[index])
        if class_index == 0 or confidence < 0.55:
            continue

        seq_meta = dataset["sequence_meta"][index]
        transaction_ids = seq_meta["transaction_ids"] or []
        relevant_transactions = [transaction for transaction in transactions if transaction["id"] in transaction_ids]
        involved_accounts = [account["id"]]
        for transaction in relevant_transactions:
            other = transaction["receiver_account_id"] if transaction["sender_account_id"] == account["id"] else transaction["sender_account_id"]
            if other not in involved_accounts:
                involved_accounts.append(other)

        total_amount = sum(safe_float(transaction["amount"]) for transaction in relevant_transactions)
        seq_values = dataset["seq_array"][index]
        graph_values = dataset["graph_array"][index]
        stats = {
            "volume_rank": float(np.mean(np.abs(seq_values[:, 1])) * 12.0 + 1.0),
            "volume_score": float(np.mean(np.abs(seq_values[:, 1]))),
            "gap_score": float(np.std(seq_values[:, 3])),
            "graph_score": float(np.mean(np.abs(graph_values[:, 0:4]))),
            "counterparty_score": float(min(len(involved_accounts) / 6.0, 1.0)),
        }

        pattern = CLASS_NAMES[class_index]

        # True IG-based attribution instead of heuristic weights
        ig_factors, ig_stats = explain_factors_ig(
            model,
            seq_array[index : index + 1],
            graph_array[index : index + 1],
            class_index,
        )
        # Supplement ig_stats with legacy counterparty info for narrative
        ig_stats.setdefault("gap_score", 0.0)
        ig_stats.setdefault("graph_score", 0.0)

        predictions.append({
            "id": f"ALRT_{uuid.uuid4().hex[:8].upper()}",
            "pattern_type": pattern,
            "involved_accounts": involved_accounts,
            "linked_transaction_ids": transaction_ids,
            "total_amount": round(total_amount, 2),
            "confidence_score": round_score(confidence),
            "shap_narrative": narrative_for_pattern(pattern, seq_meta, ig_stats, confidence),
            "shap_factors": ig_factors,
            "severity": severity_from_score(confidence, total_amount),
            "status": "open",
            "assigned_investigator": "",
            "notes": f"Model anomaly score {anomaly:.4f}",
            "created_at": utc_now(),
            "updated_at": utc_now(),
        })

    predictions.sort(key=lambda item: item["confidence_score"], reverse=True)
    return {
        "ok": True,
        "model": "graphsentinel-temporal-graph-lstm",
        "version": meta.get("version", "untrained"),
        "count": len(predictions),
        "alerts": predictions,
    }


def retrain(payload: dict[str, Any]) -> dict[str, Any]:
    result = train_model(payload)
    return {"ok": True, **result}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send(204, {})

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path == "/health":
            self._send(200, {"ok": True, "service": "graphsentinel-ml", "timestamp": utc_now()})
            return
        self._send(404, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            self._send(400, {"error": "Invalid JSON"})
            return

        try:
            if path == "/analyze":
                self._send(200, infer_alerts(body))
                return
            if path == "/retrain":
                self._send(200, retrain(body))
                return
            self._send(404, {"error": "Not found"})
        except Exception as exc:  # pragma: no cover - surfaced to Node backend
            import traceback
            err_str = traceback.format_exc()
            self._send(500, {"error": err_str})


def main() -> None:
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"GraphSentinel ML service listening on http://127.0.0.1:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()