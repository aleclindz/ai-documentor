# Database Documentation

# Database Documentation

## 1. Database Architecture

The project uses a PostgreSQL relational database hosted on AWS RDS. The database is accessed via a connection string that is stored as an environment variable for security reasons. The connection string follows the format:

```
postgresql://username:password@hostname:port/databasename
```

## 2. Schema Overview

The database consists of four main tables:

- `Users`: Stores user account information. Primary key is `user_id`.
- `Orders`: Stores order information. Primary key is `order_id`. Foreign key is `user_id` referencing `Users`.
- `Products`: Stores product information. Primary key is `product_id`.
- `Order_Products`: Junction table for many-to-many relationship between `Orders` and `Products`. Foreign keys are `order_id` referencing `Orders` and `product_id` referencing `Products`.

## 3. Query Patterns

Data is accessed and modified through SQL queries. Here are the common patterns:

- **Select**: Used to fetch data from the database. Example: `SELECT * FROM Users WHERE user_id = 1;`
- **Insert**: Used to add new data to the database. Example: `INSERT INTO Orders (order_id, user_id) VALUES (1, 1);`
- **Update**: Used to modify existing data. Example: `UPDATE Users SET username = 'new_username' WHERE user_id = 1;`
- **Delete**: Used to remove data from the database. Example: `DELETE FROM Users WHERE user_id = 1;`
- **Join**: Used to combine rows from two or more tables. Example: `SELECT * FROM Orders JOIN Order_Products ON Orders.order_id = Order_Products.order_id;`

## 4. Data Models

- `Users`
  - `user_id`: Integer, primary key, auto-increment
  - `username`: String, unique, not null
  - `password`: String, not null
  - `email`: String, unique, not null

- `Orders`
  - `order_id`: Integer, primary key, auto-increment
  - `user_id`: Integer, foreign key referencing `Users.user_id`

- `Products`
  - `product_id`: Integer, primary key, auto-increment
  - `product_name`: String, not null
  - `price`: Decimal, not null

- `Order_Products`
  - `order_id`: Integer, foreign key referencing `Orders.order_id`
  - `product_id`: Integer, foreign key referencing `Products.product_id`

## 5. Performance Considerations

- **Indexing**: All primary and foreign keys are indexed to optimize search queries. Additional indexes may be added based on usage patterns.
- **Optimization**: Regular database maintenance includes optimizing tables to reclaim storage and improve performance.
- **Caching**: Frequently accessed data is cached to reduce database load.
- **Connection Pooling**: Used to manage and maintain the database connections, reducing the overhead of establishing a new connection for every query.

## Schema



## Queries

