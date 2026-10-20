-- Create Products table
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    image TEXT,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data insert statements
INSERT INTO products (id, name, location, quantity, image, timestamp) VALUES
('1', 'Sample Product 1', 'Warehouse A', 10, 'base64_encoded_image_data', 1678901234567),
('2', 'Sample Product 2', 'Warehouse B', 15, 'base64_encoded_image_data', 1678901234568),
('3', 'Sample Product 3', 'Warehouse C', 20, 'base64_encoded_image_data', 1678901234569);

-- Create index for faster searches
CREATE INDEX idx_product_name ON products(name);
CREATE INDEX idx_product_location ON products(location);
CREATE INDEX idx_product_timestamp ON products(timestamp);

-- Note: The 'image' column uses TEXT type to store base64 encoded images. 
-- In a production environment, you might want to:
-- 1. Store images in a separate file system
-- 2. Only store image paths in the database
-- 3. Consider using BLOB type if you must store images in the database
-- 4. Add appropriate constraints and foreign keys if expanding the schema
