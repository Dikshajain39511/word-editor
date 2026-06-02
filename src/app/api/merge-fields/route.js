import { NextResponse } from "next/server";

export async function GET() {
  // Later you can fetch from DB here
  const mergeFields = [
    "customer_name",
    "loan_amount",
    "branch_name",
    "account_number",
    "loan_start_date",
  ];

  return NextResponse.json({ mergeFields });
}
