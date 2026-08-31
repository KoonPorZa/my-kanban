import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('My Kanban API')
    .setDescription('Private API for the personal Kanban and Scrum board')
    .setVersion('1.0')
    .build();

  return SwaggerModule.createDocument(app, config);
}
