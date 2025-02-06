import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import sys

from pathlib import Path

file_path = Path.cwd() / "scripts" / "data" / "currency_conversion.csv"

df = pd.read_csv(file_path)

schema = pa.schema([
    ("year", pa.int16()),
    ("usd_current", pa.float32()),
    ("usd_constant", pa.float32()),
    ("cad_current", pa.float32()),
    ("cad_constant", pa.float32()),
    ("eur_current", pa.float32()),
    ("eur_constant", pa.float32()),
    ("gbp_current", pa.float32()),
    ("gbp_constant", pa.float32())
])

table = pa.Table.from_pandas(df, schema=schema, preserve_index=False)

# Write PyArrow Table to Parquet
buf = pa.BufferOutputStream()
pq.write_table(table, buf, compression="snappy")

# Get the Parquet bytes
buf_bytes = buf.getvalue().to_pybytes()
sys.stdout.buffer.write(buf_bytes)
