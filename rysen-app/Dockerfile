# 1. Use Node image
FROM node:20-alpine AS builder

# 2. Set working directory
WORKDIR /app

# 3. Copy package.json + package-lock.json (or pnpm-lock.yaml if you use pnpm)
COPY package.json package-lock.json* ./

# 4. Install dependencies
RUN npm install

# 5. Copy all source files
COPY . .

# 6. Build React frontend and backend
RUN npm run build

# 7. Final stage — serve the app
FROM node:20-alpine

WORKDIR /app

# Install serve (used to serve static dist folder)
RUN npm install -g serve
# Copy node_modules and dist from builder stage
# COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/dist ./dist
# COPY --from=builder /app/package.json ./package.json

# You probably want to serve the React app statically, so you may need to copy `dist` or `build` dir for React (depending on your vite config)
# Assuming Vite outputs to `dist/` for frontend too — adjust if needed

COPY --from=builder /app/dist ./dist

# Expose port your Express server listens on (likely 3000)
EXPOSE 3000

# Start the static file server
CMD ["serve", "-s", "dist", "-l", "3000"]
# Run the server
# CMD ["npm", "run", "start"]
