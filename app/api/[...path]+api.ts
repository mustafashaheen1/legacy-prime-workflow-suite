import { ExpoRequest, ExpoResponse } from 'expo-router/server';
import app from '../../backend/hono.js';

export async function GET(request: ExpoRequest): Promise<ExpoResponse> {
  return app.fetch(request as any);
}

export async function POST(request: ExpoRequest): Promise<ExpoResponse> {
  return app.fetch(request as any);
}

export async function PUT(request: ExpoRequest): Promise<ExpoResponse> {
  return app.fetch(request as any);
}

export async function DELETE(request: ExpoRequest): Promise<ExpoResponse> {
  return app.fetch(request as any);
}

export async function PATCH(request: ExpoRequest): Promise<ExpoResponse> {
  return app.fetch(request as any);
}

export async function OPTIONS(request: ExpoRequest): Promise<ExpoResponse> {
  return app.fetch(request as any);
}
