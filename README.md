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
