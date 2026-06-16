---
name: aws-compute-creator-operations
description: Operations, development, and maintenance workflows for the AWS Compute Creator Next.js dashboard.
---

# AWS Compute Creator Operations Skill

This document provides instructions, guidelines, and commands for operating, developing, and extending the AWS Compute Creator application.

## Developer & Operations Commands

Use these commands for local development, testing, and compilation:

- **Start Development Server**: `npm run dev` (runs on [http://localhost:3000](http://localhost:3000))
- **Production Compilation**: `npm run build` (builds typescript and outputs optimized app bundles)
- **Production Execution**: `npm run start` (runs the built production bundle)
- **Lint Codebase**: `npm run lint` (runs ESLint code quality checks)

## Project Architecture Map

- **AWS Client Context**: [aws-client.ts](file:///c:/Users/saket/Desktop/TechRes/src/lib/aws-client.ts) handles credential verification and client instantiation.
- **Frontend Panel**: [page.tsx](file:///c:/Users/saket/Desktop/TechRes/src/app/page.tsx) handles regional resource queries, creation form submissions, state badges, copy triggers, and log monitoring.
- **Accompanying Styles**: [page.module.css](file:///c:/Users/saket/Desktop/TechRes/src/app/page.module.css) defines glassmorphic card patterns, pulsing state dots, loader animations, and developer console formatting.
- **REST Endpoints**:
  - `GET /api/aws/status` -> [status/route.ts](file:///c:/Users/saket/Desktop/TechRes/src/app/api/aws/status/route.ts)
  - `GET/POST /api/aws/instances` -> [instances/route.ts](file:///c:/Users/saket/Desktop/TechRes/src/app/api/aws/instances/route.ts)
  - `POST /api/aws/instances/[id]/terminate` -> [instances/[id]/terminate/route.ts](file:///c:/Users/saket/Desktop/TechRes/src/app/api/aws/instances/[id]/terminate/route.ts)

## Cloud Provisioning Specifications

When modifying EC2 launching logic or extending cloud features, adhere to these guidelines:

### 1. Credentials Configuration
Always extract credentials from the server environment:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (defaults to `us-east-1` if absent)

*Do not commit credentials or save them to any client-facing source code.*

### 2. AMI Resolution Pipeline
AMI IDs are region-specific. To resolve the appropriate Amazon Linux 2023 AMI:
- Query the AWS Systems Manager Parameter Store path `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64` dynamically.
- Fallback to the static regional AMI map defined in [instances/route.ts](file:///c:/Users/saket/Desktop/TechRes/src/app/api/aws/instances/route.ts) if SSM read fails.

### 3. Instance Configuration
To maximize deployment success, EC2 instances are created:
- **Free Tier profiles**: `t2.micro` or `t3.micro`.
- **Network target**: Defaults to the account's Default VPC and Default Subnet (do not hardcode subnet or security group IDs).
- **Metadata tags**: Every instance created by this application must carry:
  - `Name`: Custom label supplied by the user.
  - `CreatedBy`: `AWS-Compute-Creator` (used for resource categorization).
