import { NextResponse } from "next/server";
import { getEC2Client, getSSMClient } from "@/lib/aws-client";
import { DescribeInstancesCommand, RunInstancesCommand } from "@aws-sdk/client-ec2";
import { GetParameterCommand } from "@aws-sdk/client-ssm";

async function getLatestAMI(region: string): Promise<string> {
  try {
    const ssmClient = getSSMClient(region);
    const command = new GetParameterCommand({
      Name: "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64",
    });
    const response = await ssmClient.send(command);
    if (response.Parameter?.Value) {
      return response.Parameter.Value;
    }
  } catch (e) {
    console.warn(`Failed to fetch AMI from SSM for region ${region}, falling back to static map:`, e);
  }

  // Static fallback AMIs for Amazon Linux 2023 (x86_64) - updated 2025/2026 values
  const fallbackAMIs: Record<string, string> = {
    "us-east-1": "ami-0c614dee691d49753",
    "us-east-2": "ami-00db8dadb1161aa65",
    "us-west-1": "ami-08012c0a9ee8e21c4",
    "us-west-2": "ami-03c9c4884b1b95ec0",
    "eu-west-1": "ami-0d940f23d527c3041",
    "eu-central-1": "ami-08155452d7e974e64",
    "ap-southeast-1": "ami-09e86e11894d3fa31",
    "ap-northeast-1": "ami-00d9894e7724219c6",
  };

  return fallbackAMIs[region] || fallbackAMIs["us-east-1"];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;
    
    const ec2Client = getEC2Client(region);
    const command = new DescribeInstancesCommand({});
    const response = await ec2Client.send(command);

    const instances: any[] = [];
    if (response.Reservations) {
      for (const reservation of response.Reservations) {
        if (reservation.Instances) {
          for (const inst of reservation.Instances) {
            const nameTag = inst.Tags?.find((t) => t.Key === "Name")?.Value || "Unnamed";
            const createdByTag = inst.Tags?.find((t) => t.Key === "CreatedBy")?.Value;
            
            instances.push({
              instanceId: inst.InstanceId,
              instanceType: inst.InstanceType,
              state: inst.State?.Name,
              publicIp: inst.PublicIpAddress || null,
              privateIp: inst.PrivateIpAddress || null,
              launchTime: inst.LaunchTime,
              name: nameTag,
              createdByApp: createdByTag === "AWS-Compute-Creator",
              keyName: inst.KeyName || "None",
            });
          }
        }
      }
    }

    // Sort: active (running/pending) first, then launch time descending
    instances.sort((a, b) => {
      const stateOrder: Record<string, number> = {
        running: 1,
        pending: 2,
        "shutting-down": 3,
        stopping: 4,
        stopped: 5,
        terminated: 6,
      };
      const orderA = stateOrder[a.state || ""] || 99;
      const orderB = stateOrder[b.state || ""] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.launchTime).getTime() - new Date(a.launchTime).getTime();
    });

    return NextResponse.json({ instances });
  } catch (error: any) {
    console.error("DescribeInstances error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch instances" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { instanceName, instanceType, region } = body;

    const targetRegion = region || "us-east-1";
    const targetInstanceType = instanceType || "t2.micro";

    // Fetch the latest AMI for the selected region
    const amiId = await getLatestAMI(targetRegion);

    const ec2Client = getEC2Client(targetRegion);
    const command = new RunInstancesCommand({
      ImageId: amiId,
      InstanceType: targetInstanceType,
      MinCount: 1,
      MaxCount: 1,
      TagSpecifications: [
        {
          ResourceType: "instance",
          Tags: [
            { Key: "Name", Value: instanceName || "AWS-Compute-Creator-Instance" },
            { Key: "CreatedBy", Value: "AWS-Compute-Creator" },
          ],
        },
      ],
    });

    const response = await ec2Client.send(command);
    const launchedInstance = response.Instances?.[0];

    return NextResponse.json({
      success: true,
      instanceId: launchedInstance?.InstanceId,
      state: launchedInstance?.State?.Name,
      launchTime: launchedInstance?.LaunchTime,
    });
  } catch (error: any) {
    console.error("RunInstances error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create instance" },
      { status: 500 }
    );
  }
}
