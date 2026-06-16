import { EC2Client } from "@aws-sdk/client-ec2";
import { SSMClient } from "@aws-sdk/client-ssm";

export interface AWSConfig {
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  region: string;
}

export function getAWSConfig(): AWSConfig | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    region,
  };
}

export function getEC2Client(customRegion?: string): EC2Client {
  const config = getAWSConfig();
  if (!config) {
    throw new Error("AWS credentials are not configured in environment variables.");
  }
  return new EC2Client({
    credentials: config.credentials,
    region: customRegion || config.region,
  });
}

export function getSSMClient(customRegion?: string): SSMClient {
  const config = getAWSConfig();
  if (!config) {
    throw new Error("AWS credentials are not configured in environment variables.");
  }
  return new SSMClient({
    credentials: config.credentials,
    region: customRegion || config.region,
  });
}
