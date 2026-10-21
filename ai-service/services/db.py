"""
Database access layer for the AI service.

Reads directly from PostgreSQL (read-only queries) so the AI service
stays decoupled from the Node backend — it just needs DATABASE_URL.
"""
import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/smart_retail")


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def query_df(sql: str, params: tuple = None) -> pd.DataFrame:
    """Run a SQL query and return the result as a pandas DataFrame."""
    conn = get_connection()
    try:
        return pd.read_sql_query(sql, conn, params=params)
    finally:
        conn.close()
