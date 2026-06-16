import { NextResponse } from "next/server";
import { getEC2Client } from "@/lib/aws-client";
import { TerminateInstancesCommand } from "@aws-sdk/client-ec2";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { region } = body;

    if (!id) {
      return NextResponse.json({ error: "Instance ID is required" }, { status: 400 });
    }

    const ec2Client = getEC2Client(region);
    const command = new TerminateInstancesCommand({
      InstanceIds: [id],
    });

    const response = await ec2Client.send(command);
    const terminatingInstance = response.TerminatingInstances?.[0];

    return NextResponse.json({
      success: true,
      instanceId: terminatingInstance?.InstanceId,
      currentState: terminatingInstance?.CurrentState?.Name,
      previousState: terminatingInstance?.PreviousState?.Name,
    });
  } catch (error: any) {
    console.error("TerminateInstances error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to terminate instance" },
      { status: 500 }
    );
  }
}
