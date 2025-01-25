# Use the official Node.js image from Docker Hub
FROM node:20.9.0-alpine

# Set the working directory in the container
WORKDIR /comsec360

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code to the container
COPY . .

# Command to run your application using npm start
CMD ["npm", "start"]
