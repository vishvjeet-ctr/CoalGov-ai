# 1. Choose the base environment
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /faltu

# 3. Copy dependency files first (optimises build caching)
COPY package*.json ./

# 4. Install your application dependencies
RUN npm install

# 5. Copy the rest of your application code
COPY . .

# 6. Expose the port your app runs on
EXPOSE 3000

# 7. Define the default command to start the container
CMD ["npm", "start"]