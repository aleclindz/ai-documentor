# Database Documentation

# Database Documentation

## 1. Database Architecture

### Type

The database used in this project is a relational database management system (RDBMS) - PostgreSQL. 

### Hosting

The database is hosted on AWS RDS, a managed relational database service that provides scalable, fast, secure, and highly available databases.

### Connection Details

The database can be accessed using the following connection string:

```
postgresql://username:password@hostname:port/database
```

Replace `username`, `password`, `hostname`, `port`, and `database` with your actual database credentials.

## 2. Schema Overview

The database schema consists of the following tables:

- `users`: Stores user account information.
- `products`: Stores product details.
- `orders`: Stores order information.
- `order_items`: Stores information about individual items in an order.

The relationships between the tables are as follows:

- `users` to `orders`: One-to-many relationship. Each user can have multiple orders.
- `orders` to `order_items`: One-to-many relationship. Each order can contain multiple items.
- `products` to `order_items`: One-to-many relationship. Each product can appear in multiple order items.

## 3. Query Patterns

Data is accessed and modified using SQL queries. Here are some common patterns:

- Selecting all records from a table: `SELECT * FROM table_name`
- Selecting specific columns: `SELECT column1, column2 FROM table_name`
- Filtering records: `SELECT * FROM table_name WHERE condition`
- Inserting a new record: `INSERT INTO table_name (column1, column2) VALUES (value1, value2)`
- Updating a record: `UPDATE table_name SET column1 = value1 WHERE condition`
- Deleting a record: `DELETE FROM table_name WHERE condition`

## 4. Data Models

The structure and validation rules for the tables are as follows:

- `users`: 
  - `id`: Integer, primary key, auto-increment
  - `username`: String, unique, not null
  - `password`: String, not null
  - `email`: String, unique, not null

- `products`: 
  - `id`: Integer, primary key, auto-increment
  - `name`: String, not null
  - `price`: Decimal, not null

- `orders`: 
  - `id`: Integer, primary key, auto-increment
  - `user_id`: Integer, foreign key (`users.id`), not null
  - `date`: Date, not null

- `order_items`: 
  - `id`: Integer, primary key, auto-increment
  - `order_id`: Integer, foreign key (`orders.id`), not null
  - `product_id`: Integer, foreign key (`products.id`), not null
  - `quantity`: Integer, not null

## 5. Performance Considerations

The database uses indexing to improve query performance. Each table has an index on its primary key, and the `orders` and `order_items` tables have additional indexes on their foreign keys.

To further optimize performance, consider the following:

- Use `EXPLAIN` to analyze query performance and identify potential bottlenecks.
- Regularly update statistics using `ANALYZE`.
- Use `VACUUM` to reclaim storage occupied by dead tuples.
- Avoid full table scans by using indexes effectively.
- Use connection pooling to manage database connections efficiently.

## Dependencies

The project uses the following dependencies for database operations:

- `pg`: A non-blocking PostgreSQL client for Node.js.
- `sequelize`: A promise-based Node.js ORM for Postgres, MySQL, MariaDB, SQLite, and Microsoft SQL Server. It supports the dialects PostgreSQL, MySQL, SQLite, and MSSQL and features solid transaction support, relations, read replication, and more.

Files with Database Queries:

- `db.js`: This file contains the Sequelize setup and model definitions.
- `userController.js`, `productController.js`, `orderController.js`: These files contain the application logic and database queries for users, products, and orders, respectively.

## Schema



## Queries

