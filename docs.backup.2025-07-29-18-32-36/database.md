# Database Documentation

# Database Documentation

## 1. Database Architecture

The database used in this project is a relational database management system (RDBMS) - MySQL. It is hosted on an Amazon RDS instance. 

**Connection Details**: 

- **Host**: mydbinstance.123456789012.us-east-1.rds.amazonaws.com
- **Port**: 3306
- **Username**: admin
- **Password**: [Securely Stored]
- **Database Name**: my_database

## 2. Schema Overview

The database consists of the following tables:

- **Users**: Stores information about registered users.
- **Orders**: Stores information about orders placed by users.
- **Products**: Stores information about products available for purchase.
- **OrderDetails**: Stores information about individual items in each order.

**Relationships**:

- **Users** and **Orders**: One-to-many relationship, a user can place multiple orders.
- **Orders** and **OrderDetails**: One-to-many relationship, an order can contain multiple items.
- **Products** and **OrderDetails**: One-to-many relationship, a product can appear in multiple orders.

## 3. Query Patterns

Data is accessed and modified using SQL queries. Here are some common patterns:

- **Select**: To retrieve data from the database. Example: `SELECT * FROM Users WHERE username = 'john'`
- **Insert**: To add new records to the database. Example: `INSERT INTO Orders (user_id, order_date) VALUES (123, '2022-01-01')`
- **Update**: To modify existing records in the database. Example: `UPDATE Products SET price = 19.99 WHERE product_id = 456`
- **Delete**: To remove records from the database. Example: `DELETE FROM Users WHERE user_id = 789`

## 4. Data Models

**Users**:

- **user_id**: Integer, Primary Key, Auto Increment
- **username**: String, Unique, Not Null
- **password**: String, Not Null
- **email**: String, Unique, Not Null

**Orders**:

- **order_id**: Integer, Primary Key, Auto Increment
- **user_id**: Integer, Foreign Key (Users.user_id), Not Null
- **order_date**: Date, Not Null

**Products**:

- **product_id**: Integer, Primary Key, Auto Increment
- **product_name**: String, Not Null
- **price**: Decimal, Not Null

**OrderDetails**:

- **order_id**: Integer, Foreign Key (Orders.order_id), Not Null
- **product_id**: Integer, Foreign Key (Products.product_id), Not Null
- **quantity**: Integer, Not Null

## 5. Performance Considerations

- **Indexing**: Indexes are created on all primary keys and foreign keys to speed up data retrieval. Additional indexes are created on columns that are frequently used in WHERE clauses.
- **Optimization**: Queries are optimized to reduce the amount of data that needs to be read from the database. For example, SELECT statements only include the columns that are needed, and JOINs are used instead of multiple SELECT statements.
- **Database Design**: The database is normalized to reduce data redundancy and improve data integrity. However, denormalization is used where necessary to improve performance.
- **Caching**: Frequently accessed data is cached to reduce the load on the database.

## Schema



## Queries

