import { connect } from "@lancedb/lancedb";

async function viewData() {
  try {
    // Connect to the database
    const db = await connect("./lancedb");
    console.log("Connected to LanceDB");
    
    // Open the table
    const table = await db.openTable("documents_vector_store");
    console.log("Table opened successfully");
    
    // Option 1: Try using the toArrow method
    const data = await table.toArrow();
    console.log("Data retrieved:", data);
    
    // Option 2: Use the query method correctly
    const queryResult = await table.query();
    console.log("Query result:", queryResult);
    
    // Count rows to verify data exists
    const count = await table.countRows();
    console.log(`Total rows in table: ${count}`);
 
    const tables = await db.tableNames();
    console.log("Available tables:", tables);

} 
    catch (error) {
    console.error("Error details:", error);
  }
}

 
viewData().catch(error => console.error("Error viewing data:", error));
