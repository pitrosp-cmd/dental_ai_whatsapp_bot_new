import sqlite3 from "sqlite3";
sqlite3.verbose();

const db = new sqlite3.Database("./patients.db");

db.run(`CREATE TABLE IF NOT EXISTS sessions(
  id TEXT,
  notes TEXT,
  score INTEGER,
  time DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

export function saveSession(id,notes,score){
  db.run(`INSERT INTO sessions(id,notes,score) VALUES(?,?,?)`,
    [id, JSON.stringify(notes), score]
  );
}
// database placeholder - full code provided in chat
