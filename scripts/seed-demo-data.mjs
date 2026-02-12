// Seed realistic demo data via the API for screenshot purposes
const API = "http://localhost:8000/api";
let token = null;

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// Helper: convert {key: value} to [{field_key, field_value}]
function f(obj) {
  return Object.entries(obj).map(([field_key, field_value]) => ({
    field_key,
    field_value,
  }));
}

async function run() {
  // Login
  console.log("Logging in...");
  const auth = await api("POST", "/auth/login", {
    email: "demo@familyvault.local",
    password: "demo1234",
  });
  token = auth.token;
  console.log("  Logged in as", auth.user.email);

  // --- Family IDs ---
  console.log("\nCreating Family IDs...");

  await api("POST", "/items", {
    category: "ids",
    subcategory: "drivers_license",
    name: "John Smith - Driver's License",
    fields: f({
      full_name: "John Michael Smith",
      license_number: "D123-4567-8901",
      state: "California",
      issue_date: "2023-03-15",
      expiration_date: "2028-03-15",
    }),
  });
  console.log("  + Driver's License (John)");

  await api("POST", "/items", {
    category: "ids",
    subcategory: "drivers_license",
    name: "Sarah Smith - Driver's License",
    fields: f({
      full_name: "Sarah Anne Smith",
      license_number: "D987-6543-2100",
      state: "California",
      issue_date: "2022-07-20",
      expiration_date: "2027-07-20",
    }),
  });
  console.log("  + Driver's License (Sarah)");

  await api("POST", "/items", {
    category: "ids",
    subcategory: "passport",
    name: "John Smith - Passport",
    fields: f({
      full_name: "John Michael Smith",
      passport_number: "567890123",
      country: "United States",
      issue_date: "2021-06-01",
      expiration_date: "2031-06-01",
    }),
  });
  console.log("  + Passport (John)");

  await api("POST", "/items", {
    category: "ids",
    subcategory: "passport",
    name: "Sarah Smith - Passport",
    fields: f({
      full_name: "Sarah Anne Smith",
      passport_number: "432109876",
      country: "United States",
      issue_date: "2022-01-10",
      expiration_date: "2032-01-10",
    }),
  });
  console.log("  + Passport (Sarah)");

  await api("POST", "/items", {
    category: "ids",
    subcategory: "birth_certificate",
    name: "Emma Smith - Birth Certificate",
    fields: f({
      full_name: "Emma Rose Smith",
      date_of_birth: "2019-09-14",
      place_of_birth: "Los Angeles, CA",
      certificate_number: "2019-LA-094521",
    }),
  });
  console.log("  + Birth Certificate (Emma)");

  await api("POST", "/items", {
    category: "ids",
    subcategory: "social_security",
    name: "John Smith - SSN",
    fields: f({
      full_name: "John Michael Smith",
      ssn: "***-**-4589",
    }),
  });
  console.log("  + Social Security (John)");

  await api("POST", "/items", {
    category: "ids",
    subcategory: "social_security",
    name: "Sarah Smith - SSN",
    fields: f({
      full_name: "Sarah Anne Smith",
      ssn: "***-**-7821",
    }),
  });
  console.log("  + Social Security (Sarah)");

  // --- Insurance ---
  console.log("\nCreating Insurance policies...");

  await api("POST", "/items", {
    category: "insurance",
    subcategory: "health_insurance",
    name: "Blue Cross Family Plan",
    fields: f({
      provider: "Blue Cross Blue Shield",
      member_id: "XYZ123456789",
      policy_number: "BCB-2024-78901",
      group_number: "GRP-55421",
      plan_type: "ppo",
      effective_date: "2024-01-01",
      premium: "1850",
    }),
  });
  console.log("  + Health Insurance");

  await api("POST", "/items", {
    category: "insurance",
    subcategory: "auto_insurance",
    name: "State Farm Auto Policy",
    fields: f({
      provider: "State Farm",
      policy_number: "SF-AUTO-2024-34521",
      premium: "2400",
      start_date: "2024-06-01",
      end_date: "2025-06-01",
    }),
  });
  console.log("  + Auto Insurance");

  await api("POST", "/items", {
    category: "insurance",
    subcategory: "homeowners_insurance",
    name: "Allstate Home Policy",
    fields: f({
      provider: "Allstate",
      policy_number: "ALL-HOME-789012",
      policy_type: "ho3",
      premium: "3200",
      payment_frequency: "annual",
      start_date: "2024-03-01",
      end_date: "2025-03-01",
      property_address: "1234 Oak Lane, Los Angeles, CA 90001",
      property_type: "single_family",
      year_built: "2005",
      square_footage: "2400",
    }),
  });
  console.log("  + Homeowners Insurance");

  await api("POST", "/items", {
    category: "insurance",
    subcategory: "life_insurance",
    name: "Northwestern Mutual Life",
    fields: f({
      provider: "Northwestern Mutual",
      policy_number: "NWM-LIFE-456789",
      policy_type: "term",
      premium: "85",
      payment_frequency: "monthly",
      start_date: "2023-01-15",
      end_date: "2043-01-15",
    }),
  });
  console.log("  + Life Insurance");

  // --- Business ---
  console.log("\nCreating Business documents...");

  await api("POST", "/items", {
    category: "business",
    subcategory: "llc",
    name: "Smith Digital LLC",
    fields: f({
      business_name: "Smith Digital LLC",
      ein: "82-1234567",
      formation_date: "2021-04-15",
      state_of_formation: "California",
      registered_agent: "LegalZoom Registered Agent",
      has_employees: "yes",
      tax_election: "s_corp",
      address_line_1: "456 Business Park Dr",
      city: "Los Angeles",
      state: "California",
      zip_code: "90015",
    }),
  });
  console.log("  + LLC (Smith Digital)");

  await api("POST", "/items", {
    category: "business",
    subcategory: "llc",
    name: "Smith Properties LLC",
    fields: f({
      business_name: "Smith Properties LLC",
      ein: "83-9876543",
      formation_date: "2022-09-01",
      state_of_formation: "California",
      registered_agent: "LegalZoom Registered Agent",
      has_employees: "no",
      tax_election: "single_member",
    }),
  });
  console.log("  + LLC (Smith Properties)");

  await api("POST", "/items", {
    category: "business",
    subcategory: "business_license",
    name: "City Business License - Smith Digital",
    fields: f({
      license_type: "General Business License",
      license_number: "BL-2024-00891",
      issuing_authority: "City of Los Angeles",
      issue_date: "2024-01-01",
      expiration_date: "2024-12-31",
    }),
  });
  console.log("  + Business License");

  await api("POST", "/items", {
    category: "business",
    subcategory: "general_liability",
    name: "Hiscox GL Policy - Smith Digital",
    fields: f({
      provider: "Hiscox",
      policy_number: "HSX-GL-2024-11234",
      premium: "1200",
      payment_frequency: "annual",
      per_occurrence_limit: "1000000",
      aggregate_limit: "2000000",
      start_date: "2024-01-01",
      end_date: "2025-01-01",
    }),
  });
  console.log("  + General Liability Insurance");

  // --- Reminders (custom) ---
  console.log("\nCreating custom reminders...");

  // Get item IDs for reminders
  const itemsRes = await api("GET", "/items");
  const items = itemsRes.items || itemsRes;
  const dlItem = items.find(i => i.name.includes("John Smith - Driver"));
  if (dlItem) {
    await api("POST", `/items/${dlItem.id}/reminders`, {
      title: "Renew driver's license",
      due_date: "2028-02-15",
      notes: "Schedule DMV appointment 2 months before expiration",
    });
    console.log("  + DL renewal reminder");
  }

  const bizLicense = items.find(i => i.name.includes("City Business License"));
  if (bizLicense) {
    await api("POST", `/items/${bizLicense.id}/reminders`, {
      title: "Renew business license",
      due_date: "2024-11-15",
      notes: "Submit renewal application by mid-November",
    });
    console.log("  + Business license renewal reminder");
  }

  console.log("\nDone! Demo data seeded successfully.");
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
