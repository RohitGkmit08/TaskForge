
function validateAndTransformRecord(record) {
  // Array to collect all validation errors
  const errors = [];

  // 1. Validate name
  const name = typeof record?.name === "string" ? record.name.trim() : "";

  if (!name) {
    errors.push({
      field: "name",
      message: "Name is required",
    });
  }

  // 2. Validate age
  const rawAge =
    typeof record?.age === "string"
      ? record.age.trim()
      : typeof record?.age === "number" && !Number.isNaN(record.age)
      ? String(record.age)
      : "";

  let age;

  if (!rawAge) {
    errors.push({
      field: "age",
      message: "Age is required",
    });
  } else if (!/^-?\d+$/.test(rawAge)) {
    errors.push({
      field: "age",
      message: "Age must be a valid integer",
    });
  } else {
    age = Number(rawAge);

    if (age < 1 || age > 120) {
      errors.push({
        field: "age",
        message: "Age must be between 1 and 120",
      });
    }
  }

  // 3. Validate city
  const city = typeof record?.city === "string" ? record.city.trim() : "";

  if (!city) {
    errors.push({
      field: "city",
      message: "City is required",
    });
  }

  // 4. Return validation result
  if (errors.length > 0) {
    return {
      valid: false,
// Fail-safe design is the engineering principle behind deciding what the system should do when data is unavailable.
// The objective isn't simply to prevent crashes. It's to ensure that failures don't lead to dangerous, inconsistent, or unpredictable behavior.
      data: null,
      errors,
    };
  }

  // 5. Return transformed record
  return {
    valid: true,
    data: {
      name,
      age,
      city,
    },
    errors: [],
  };
}

module.exports = { validateAndTransformRecord };
