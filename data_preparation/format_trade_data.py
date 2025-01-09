from data_preparation.utils.cepii_wrangler import process_africa_trade_data

# Process CEPII data
process_africa_trade_data(2002, 2022, save_as="parquet")
