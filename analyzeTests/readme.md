1. npm install

2. node consolidate-data.mjs
3. node analyze-data.mjs
4. node generate-charts.mjs

5. brew install sqlite3

6. node store-in-sqlite.mjs

7. node query-sqlite.mjs "select server,  Model_Name_______________, duration, context, temp from performance order by duration asc"




-------------------------------
sqlite3 performance_data.db

.tables                     # List all tables
.schema performance         # Show table structure
SELECT * FROM performance;  # View all data
.mode column                # Format output as columns
.headers on                 # Show column headers
.quit                       # Exit SQLite

