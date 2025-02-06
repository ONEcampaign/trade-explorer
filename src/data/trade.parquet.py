import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import sys

from pathlib import Path

file_path = Path.cwd() / "scripts" / "data" / "trade_2002_2023.csv"

df = pd.read_csv(file_path)

columns = df.columns.tolist()
categories = [col for col in columns if col not in ["year", "exporter", "importer"]]

base_schema = [
    ("year", pa.int16()),
    ("exporter", pa.dictionary(index_type=pa.int8(), value_type=pa.string())),
    ("importer", pa.dictionary(index_type=pa.int8(), value_type=pa.string())),
]

dynamic_schema = [(col, pa.float32()) for col in categories]

schema = pa.schema(base_schema + dynamic_schema)

table = pa.Table.from_pandas(df, schema=schema, preserve_index=False)

# Write PyArrow Table to Parquet
buf = pa.BufferOutputStream()
pq.write_table(table, buf, compression="snappy")

# Get the Parquet bytes
buf_bytes = buf.getvalue().to_pybytes()
sys.stdout.buffer.write(buf_bytes)
