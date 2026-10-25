# TaskForge - Backend

A robust, backend-first background job processing system built with Node.js, Express, MongoDB, Redis, and BullMQ.

## Features
- **Asynchronous Job Execution**: Decoupled task offloading using Redis and BullMQ queues.
- **Worker Concurrency**: Scalable and configurable worker concurrency for processing workloads in parallel.
- **Automatic Retries & Exponential Backoff**: Resilient failure recovery mechanisms.
- **Job Lifecycle & Monitoring**: MongoDB audit logs and status tracking (waiting, active, completed, failed, delayed).
- **Rate Limiting & Concurrency Control**: Prevents resource starvation and respects external service limits.

## Tech Stack
- **Runtime**: Node.js
- **Web Framework**: Express.js
- **Queue Engine**: BullMQ
- **In-Memory Store / Broker**: Redis (ioredis)
- **Database**: MongoDB (Mongoose)

## Directory Structure
```text
src/
├── config/        # Redis, Mongo, and app configurations
├── queues/        # BullMQ queue definitions
├── workers/       # BullMQ worker consumers & task logic
├── jobs/          # Job producers & payload schemas
├── controllers/   # Express route controllers
├── routes/        # API route definitions
├── models/        # Mongoose data models & job logs
├── middlewares/   # Auth, validation, error handling
└── utils/         # Helper utilities and logger
```
