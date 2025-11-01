# Use a lightweight nginx image as the base
FROM nginx:alpine

# Set the working directory inside the container
WORKDIR /usr/share/nginx/html

# Remove the default nginx page
RUN rm -f index.html

# Copy the UI files into the nginx public directory
COPY index.html .
COPY style.css .
COPY app.js .

# Expose port 80 for the web server
EXPOSE 80

# The default nginx command will start the server automatically when the container starts
CMD ["nginx", "-g", "daemon off;"]
