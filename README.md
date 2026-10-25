# TaskForge

A backend-first background job processing system built with Node.js, Express, MongoDB, Redis, and BullMQ, featuring asynchronous execution, retries, concurrency control, and job monitoring.

## Repository Structure

```text
TaskForge/
├── backend/    # Express API, BullMQ queues, workers, Redis & MongoDB integration
└── frontend/   # Job monitoring dashboard & user interface
```

## Branch Strategy
- **`main`**: Production-ready, stable releases.
- **`dev`**: Active development branch. All feature work and pull requests happen here before merging into `main`.

## Getting Started
Refer to the individual project directories for specific setup and configuration instructions:
- [Backend Documentation](file:///backend/README.md)
- [Frontend Documentation](file:///frontend/README.md)
