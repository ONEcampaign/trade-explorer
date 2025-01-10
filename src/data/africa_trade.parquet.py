import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import sys

from pathlib import Path


SAVED_CSV = Path.cwd() / "data_preparation" / "data" / "africa_trade_2002_2022.csv"

df = pd.read_csv(SAVED_CSV)

# Write DataFrame to a temporary file-like object
buf = pa.BufferOutputStream()
table = pa.Table.from_pandas(df)
pq.write_table(table, buf, compression="snappy")
# Get the buffer as a bytes object
buf_bytes = buf.getvalue().to_pybytes()
# Write the bytes to standard output
sys.stdout.buffer.write(buf_bytes)
