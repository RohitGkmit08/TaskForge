# TaskForge

A resilient, scalable background job processing and monitoring system built with **Node.js**, **Express**, **MongoDB**, **Redis**, and **BullMQ**.

**TaskForge** (JobFlow) is a backend-focused architecture project designed to explore how asynchronous workloads are ingested, queued, executed, monitored, and recovered in production-grade environments. Rather than simply serving as an API that creates database records, TaskForge demonstrates the mechanics of distributed task processing—handling execution lifecycles, worker concurrency, failure isolation, exponential backoff retries, and state recovery.

---

## Overview

In modern backend architectures, long-running or resource-intensive tasks should not execute synchronously within the lifecycle of an HTTP request. Operations such as ingesting large CSV datasets, generating complex analytical reports, batch processing media, or communicating with third-party webhooks can lead to gateway timeouts, thread blocking, and fragile error states.

TaskForge decouples HTTP request handling from background job execution:

1. **Non-blocking Ingestion**: A client submits a task via the REST API.
2. **Immediate Acknowledgment**: The system validates the request, persists an initial job record, and enqueues the job payload.
3. **Decoupled Execution**: Dedicated background workers pick up queued jobs asynchronously without blocking the API.
4. **State Observability**: Clients can poll execution progress, inspect intermediate results, and review error diagnostics, while a frontend dashboard provides real-time oversight.

---

## Core Goals

- **Decouple Request Handling**: Separate client-facing HTTP endpoints from compute- and I/O-intensive background workloads.
- **Model & Persist Lifecycles**: Maintain end-to-end state transitions, execution progress (0–100%), and failure traces in MongoDB.
- **Dedicated Worker Orchestration**: Run isolated background worker processes capable of scaling independently from the API server.
- **Fault Tolerance & Retries**: Handle transient failures with configurable exponential backoff, dead-letter recovery, and concurrency limits.
- **Comprehensive Observability**: Track execution metrics, detailed error stacks, and job payloads across the system.
- **Monitoring Dashboard**: Deliver an intuitive React-based user interface for dispatching workloads, viewing queue states, and inspecting task details.
- **Production Foundations**: Establish clean software design patterns, end-to-end integration testing, containerization readiness, and automated CI/CD workflows.

---

## System Architecture

The target architecture separates the HTTP API, persistent storage, queuing substrate, and background worker processes into distinct, modular components.

```text
                  +-------------------------+
                  |   React Monitoring UI   |
                  +------------+------------+
                               |
                               v (HTTP / REST)
                  +-------------------------+
                  |     Express.js API      |
                  +-------+---------+-------+
                          |         |
             Persist Job  |         | Enqueue Job
             Metadata     v         v
                +-------------+  +---------------+
                |   MongoDB   |  | Redis / BullMQ|
                | (Job Store) |  |  (Job Queue)  |
                +------+------+  +-------+-------+
                       ^                 |
                       |                 | Dequeue Task
        Update State & |                 v
        Progress (0-100%)      +-----------------+
                       +-------+ Node.js Worker  |
                               +--------+--------+
                                        |
                                        v
                               +-----------------+
                               | Job Processor   |
                               |  (CSV Import)   |
                               +-----------------+
```

### Component Responsibilities

| Component | Technology | Responsibility |
| :--- | :--- | :--- |
| **Dashboard** | React, Vite | Submits jobs and provides real-time visibility into queue states, job progress, and execution results. |
| **API Server** | Express.js | Validates incoming payloads, creates persistent job entities, and exposes query/management endpoints. |
| **Database** | MongoDB & Mongoose | Persists job metadata, lifecycle history, progress metrics, execution results, and error traces. |
| **Message Broker** | Redis | High-throughput, in-memory data store acting as the backing broker for job scheduling and delivery. |
| **Queue Engine** | BullMQ | Orchestrates job dispatching, delayed execution, worker concurrency, and automated retries. |
| **Worker** | Node.js Worker | Independent execution process that polls Redis, manages concurrency, and drives task lifecycles. |
| **Processor** | Modular Handler | Task-specific business logic (starting with chunked CSV parsing, row validation, and batch persistence). |

> **Note:** Components are introduced iteratively. The backend API, schema models, and base controllers are established first, followed by queue integration, worker execution, and the frontend dashboard.

---

## Initial Use Case: CSV Data Ingestion

The initial workload implemented is a **CSV Import Pipeline**. Large file uploads and row-by-row validation represent a quintessential asynchronous challenge:

1. **Submission**: A client submits a CSV import request to `POST /api/jobs` with the task type and file configuration.
2. **Validation & Creation**: Express validates the request payload and creates a new document in MongoDB initialized with `QUEUED` status.
3. **Queueing**: The job payload is dispatched to the BullMQ Redis queue.
4. **Worker Consumption**: A background worker claims the task from Redis and updates the job status in MongoDB to `PROCESSING`.
5. **Streaming & Processing**: The CSV processor reads and validates the dataset in streams/batches to prevent high memory overhead.
6. **Progress Tracking**: Incremental progress (0% to 100%) and partial ingestion metrics are updated in real time.
7. **Resolution**: On successful completion, output summaries are stored and the status is transitioned to `COMPLETED`. If an unrecoverable error occurs, stack traces are captured and status becomes `FAILED`.
8. **Client Verification**: The client polls `GET /api/jobs/:id` or views live updates directly on the dashboard.

Targeting a single workload first allows for end-to-end verification of reliability, failure recovery, and state transitions before expanding to additional job types.

---

## Job Lifecycle & State Machine

TaskForge models job processing as a finite state machine:

```text
                     +----------------+
                     |     QUEUED     | <----+ (Auto-Retry with Backoff)
                     +-------+--------+      |
                             |               |
                             v               |
                     +----------------+      |
                     |   PROCESSING   |      |
                     +---+--------+---+      |
                         |        |          |
            [On Success] |        | [On Failure & Retry Pending]
                         v        v          |
                   +-----------+  +----------+
                   | COMPLETED |  |  FAILED  |
                   +-----------+  +----------+
```

- **`QUEUED`**: The job has been validated and persisted in MongoDB; it is currently waiting in BullMQ for available worker capacity.
- **`PROCESSING`**: An active worker has claimed the job and is currently executing the task logic while emitting incremental progress updates.
- **`COMPLETED`**: Processing concluded successfully; results, record counts, and execution timestamps have been persisted.
- **`FAILED`**: The task encountered a fatal error or exhausted its allocated retry budget. Detailed error traces are saved for auditing and triage.

### Retries & Recovery
When configured, transient failures automatically trigger BullMQ retries using exponential backoff. Eligible failed jobs transition back through queue scheduling rather than failing permanently on intermittent blips.

---

## Technology Stack

| Technology | Role | Purpose |
| :--- | :--- | :--- |
| **Node.js** | Runtime | Asynchronous, event-driven JavaScript execution for API and workers |
| **Express.js** | Web Framework | Lightweight HTTP routing, middleware pipeline, and REST API |
| **MongoDB** | Database | Flexible document store for persistent job entities and payloads |
| **Mongoose** | ODM | Object data modeling, schema validation, and lifecycle hooks |
| **Redis** | In-Memory Broker | High-performance broker backing BullMQ queue operations |
| **BullMQ** | Queue Manager | Distributed job orchestration, retries, concurrency, and rate limiting |
| **React** | Frontend UI | Component-based dashboard for interactive job submission and monitoring |
| **Vite** | Build Tool | Fast build tooling and local development server for the frontend |
| **GitHub Actions** | CI/CD | Continuous integration, automated test runners, and deployment workflows |

---

## Repository Structure

```text
TaskForge/
├── backend/            # Express API, BullMQ queues, workers, Redis & MongoDB integration
│   ├── src/
│   │   ├── config/     # Database and Redis connections
│   │   ├── controllers/# API route handlers
│   │   ├── models/     # Mongoose models & schemas (Job.js)
│   │   ├── routes/     # Express route definitions (/api/jobs)
│   │   ├── services/   # Business logic and queue orchestration
│   │   ├── workers/    # BullMQ worker consumers (planned)
│   │   ├── queues/     # BullMQ queue instances (planned)
│   │   └── server.js   # Server entrypoint
│   └── README.md       # Backend documentation & API reference
│
└── frontend/           # React + Vite monitoring dashboard
    └── README.md       # Frontend setup & UI guide
```

---

## Branch Strategy

- **`main`**: Production-ready, stable releases.
- **`dev`**: Active integration and development branch. All feature branches (`feat/*`, `fix/*`) are reviewed and merged here before reaching `main`.

---

## Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB** (Local instance or MongoDB Atlas)
- **Redis** (Local server or Redis Cloud)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

For detailed endpoints and configuration details, see the [Backend Documentation](./backend/README.md).  
For frontend setup, see the [Frontend Documentation](./frontend/README.md).

---

## Environment Configuration

TaskForge relies on environment variables defined in `backend/.env`. A template is provided in `backend/.env.example`:

| Variable | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Number | `5001` | Port on which the Express.js API server listens |
| `NODE_ENV` | String | `development` | Runtime environment mode |
| `MONGO_URI` | String | `mongodb://localhost:27017/taskforge` | MongoDB connection URI for job persistence and audit logs |
| `REDIS_HOST` | String | `127.0.0.1` | Hostname/IP address of the Redis message broker |
| `REDIS_PORT` | Number | `6379` | Port number of the Redis message broker |
| `REDIS_PASSWORD` | String | *(optional)* | Password for authenticated Redis instances |

---

## Running the Application

Because TaskForge implements a decoupled architecture, the HTTP API server and the background workers run as separate, independent Node.js processes.

### 1. Start the API Server
In your first terminal:
```bash
cd backend
npm run dev      # Runs with nodemon for hot-reloading
# or: npm start  # Runs standard Node.js server
```
*The server will initialize MongoDB connection and listen on `http://localhost:5001`.*

### 2. Start the CSV Import Worker
In a second terminal:
```bash
cd backend
npm run worker   # Executes node src/workers/csvImport.worker.js
```
*The worker establishes connections to both MongoDB and Redis, registers event listeners, and starts listening for jobs on the `csv-import-queue`.*

---

## REST API Reference

All job management routes are prefixed with `/api/jobs`.

### 1. Create & Enqueue a Job

Submits a new asynchronous task. The API validates the payload, creates a persistent job record in MongoDB with `QUEUED` status, and pushes the task to the BullMQ Redis queue.

- **Endpoint**: `POST /api/jobs`
- **Headers**: `Content-Type: application/json`

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | String | Yes | Type of job. Currently supported: `"CSV_IMPORT"`. |
| `payload` | Object | Yes | Task-specific configuration payload (must be a non-array JSON object). |

#### Example Request
```bash
curl -X POST http://localhost:5001/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CSV_IMPORT",
    "payload": {
      "fileUrl": "https://example.com/datasets/users_data.csv",
      "delimiter": ",",
      "batchSize": 500
    }
  }'
```

#### Success Response (`201 Created`)
```json
{
  "job": {
    "_id": "6727a2e5d909f1234567890a",
    "type": "CSV_IMPORT",
    "status": "QUEUED",
    "payload": {
      "fileUrl": "https://example.com/datasets/users_data.csv",
      "delimiter": ",",
      "batchSize": 500
    },
    "progress": 0,
    "attempts": 0,
    "result": null,
    "error": null,
    "createdAt": "2026-11-07T15:40:00.000Z",
    "updatedAt": "2026-11-07T15:40:00.000Z",
    "__v": 0
  }
}
```

#### Error Responses
- **`400 Bad Request`** (Missing or invalid payload format):
  ```json
  {
    "message": "type and a valid payload object are required"
  }
  ```
- **`400 Bad Request`** (Mongoose schema validation failure):
  ```json
  {
    "message": "`INVALID_TYPE` is not a valid enum value for path `type`."
  }
  ```
- **`500 Internal Server Error`** (Queue dispatch failure or server crash):
  ```json
  {
    "message": "Internal server error"
  }
  ```
  *(Note: If BullMQ enqueueing fails, the MongoDB job status is automatically updated to `FAILED` with the error trace before throwing).*

---

### 2. Get Job Details & Progress

Polls the status, progress percentage, result, or error trace of a specific job by its MongoDB ObjectId.

- **Endpoint**: `GET /api/jobs/:id`

#### Path Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Yes | 24-character hexadecimal MongoDB ObjectId. |

#### Example Request
```bash
curl -X GET http://localhost:5001/api/jobs/6727a2e5d909f1234567890a
```

#### Success Response (`200 OK`)
```json
{
  "job": {
    "_id": "6727a2e5d909f1234567890a",
    "type": "CSV_IMPORT",
    "status": "COMPLETED",
    "payload": {
      "fileUrl": "https://example.com/datasets/users_data.csv",
      "delimiter": ",",
      "batchSize": 500
    },
    "progress": 100,
    "attempts": 1,
    "result": {
      "received": true,
      "message": "Worker execution verified"
    },
    "error": null,
    "createdAt": "2026-11-07T15:40:00.000Z",
    "updatedAt": "2026-11-07T15:40:05.000Z",
    "__v": 0
  }
}
```

#### Error Responses
- **`400 Bad Request`** (Malformed ObjectId):
  ```json
  {
    "message": "Invalid job ID"
  }
  ```
- **`404 Not Found`** (Job does not exist):
  ```json
  {
    "message": "Job not found"
  }
  ```

---

## Data Model Reference

The MongoDB document schema (`backend/src/models/Job.js`) stores the full lifecycle history and telemetry of every dispatched task:

```javascript
{
  type: String,       // Required. Enum: ["CSV_IMPORT"]
  status: String,     // Required. Enum: ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"]. Default: "QUEUED"
  payload: Mixed,     // Required. Stores job input parameters
  progress: Number,   // Number between 0 and 100. Default: 0
  attempts: Number,   // Non-negative integer. Incremented automatically on worker pickup. Default: 0
  result: Mixed,      // Output data, metrics, or summaries upon completion. Default: null
  error: String,      // Fatal error message or stack trace if the task fails. Default: null
  createdAt: Date,    // Timestamp of task submission (auto-managed)
  updatedAt: Date     // Timestamp of latest status/progress update (auto-managed)
}
```

---

## BullMQ Queue & Worker Architecture

TaskForge coordinates distributed tasks across two distinct persistence layers:

1. **MongoDB (`Job` Collection)**: Provides persistent, queryable state storage for HTTP clients, dashboards, and historical audit records.
2. **Redis (`BullMQ` Queue)**: Provides fast in-memory job coordination, worker polling, concurrency control, and scheduling.

### Correlation Between Systems
When a job is submitted via `jobService.createJob()`:
- A MongoDB record is created first, generating an `_id` (e.g. `6727a2e5d909f1234567890a`).
- BullMQ adds the job to `csv-import-queue` with:
  - Job name: `"process-csv-import"`
  - Data payload: `{ mongoJobId: job._id.toString(), payload: job.payload }`
  - BullMQ Job ID: `{ jobId: job._id.toString() }`
- This ensures a 1:1 deterministic mapping between the BullMQ queue item and the MongoDB document.

### Worker Execution Sequence
The worker process (`backend/src/workers/csvImport.worker.js`):
1. Connects to MongoDB (`connectDB()`) and Redis (`connection` configured with `maxRetriesPerRequest: null`).
2. Listens on `csv-import-queue`.
3. When a task is claimed:
   - Updates MongoDB status to `PROCESSING` and increments `attempts` by 1 (`$inc: { attempts: 1 }`).
   - Executes the processing logic with the input payload.
   - On success: updates MongoDB status to `COMPLETED`, sets `progress` to `100`, records the `result` object, and clears any previous error.
   - On failure: catches the thrown exception, transitions MongoDB status to `FAILED`, persists `error.message`, and emits BullMQ's `failed` event.

---

## Diagnostic & Streaming Utilities

The `backend/` directory includes helper scripts for diagnosing queues and experimenting with Node.js stream architectures:

### Queue Diagnostics
- **`node test-queue.js`**: Connects to the Redis queue instance, calls `csvImportQueue.waitUntilReady()`, logs connection readiness, and safely closes the queue connection.
- **`node inspect-queue.js`**: Fetches a job by ID from BullMQ using `csvImportQueue.getJob(id)` and prints its internal state (`waiting`, `active`, `completed`, `failed`), name, and stored payload.

### Node.js Stream Foundations
To prepare for high-volume streaming CSV data processing without memory exhaustion, several stream prototype scripts are provided:
- **`node backpressure.js`**: Demonstrates stream flow control between a readable stream (`highWaterMark: 10`) and writable stream, pausing the readable stream when backpressure is detected (`!writeable.write(chunk)`) and resuming on the writable stream's `drain` event.
- **`node transform.js`**: Demonstrates pipeline data transformation using Node.js `Transform` and `pipeline` utilities (converting text chunks to uppercase).
- **`node chain-transform.js`**: Demonstrates multi-stage sequential stream transformations (converting text to uppercase, then substituting spaces with underscores).
- **`node streams.js` & `node pipe.js`**: Basic stream chunk inspection and direct readable-to-writable pipe operations.

---

## Step-by-Step Verification Walkthrough

To verify the end-to-end flow locally:

1. **Verify Services**: Ensure local Redis and MongoDB instances are active:
   ```bash
   redis-cli ping   # Should return PONG
   mongosh --eval "db.adminCommand('ping')" # Should return { ok: 1 }
   ```

2. **Test Queue Connectivity**:
   ```bash
   cd backend
   node test-queue.js
   # Output: BullMQ queue connected to Redis successfully
   ```

3. **Start the API Server** (Terminal 1):
   ```bash
   cd backend
   npm run dev
   # Output: MongoDB connected successfully
   # Output: JobFlow server running on port 5001
   ```

4. **Start the Background Worker** (Terminal 2):
   ```bash
   cd backend
   npm run worker
   # Output: MongoDB connected successfully
   # Output: CSV Import Worker is listening...
   ```

5. **Submit a New Job** (Terminal 3):
   ```bash
   curl -X POST http://localhost:5001/api/jobs \
     -H "Content-Type: application/json" \
     -d '{"type": "CSV_IMPORT", "payload": {"fileUrl": "https://example.com/test.csv"}}'
   ```
   *Copy the returned `_id`.*

6. **Observe Worker Processing**:
   Terminal 2 logs will immediately display:
   ```text
   Worker picked up job: 6727a2e5d909f1234567890a
   Job 6727a2e5d909f1234567890a completed
   Result: { received: true, message: 'Worker execution verified' }
   ```

7. **Poll Job Status**:
   ```bash
   curl http://localhost:5001/api/jobs/<YOUR_JOB_ID>
   ```
   *The response will show `"status": "COMPLETED"`, `"progress": 100`, and `"attempts": 1`.*

