# Use the AWS Lambda Node.js base image directly
FROM public.ecr.aws/lambda/nodejs:22

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Install Playwright without browsers (we'll use serverless approach)
RUN npx playwright install-deps || echo "Some deps might not be available in Lambda environment"

# Note: For production Lambda, consider using @sparticuz/chromium package instead
# This is a simplified approach for local testing

# Copy source code
COPY index.js ./
COPY src/ ./src/

# Copy source code
COPY index.js ./
COPY src/ ./src/

# Set environment variables for Lambda
ENV NODE_ENV=production

# Lambda configuration (use default entrypoint)
CMD ["index.lambda_handler"]