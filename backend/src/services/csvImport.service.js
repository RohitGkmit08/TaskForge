
async function* createBatches(records, batchSize) {
    // Start with an empty array.
  let batch = [];

  //Go through the records one by one, "for await" because "records" might arrive slowly
  for await (const record of records) {

    // push the record in the array.
    batch.push(record);

    // if the array is full, return the yeild and start a new empty array.
    if (batch.length === batchSize) {
      yield batch;
      batch = [];
    }
  }

  // Emit the remaining records, if any.
  if (batch.length > 0) {
    yield batch;
  }
}

module.exports = {createBatches};
