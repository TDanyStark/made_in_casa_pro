// app/actions.ts
"use server";

import { connectDB } from "./neon";

export async function getData() {
    const sql = await connectDB(); 
    const data = await sql`CREATE TABLE IF NOT EXISTS test (id SERIAL PRIMARY KEY, name TEXT)`;
    return data;
}