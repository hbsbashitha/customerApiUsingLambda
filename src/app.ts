import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { customerCreateSchema, customerUpdateSchema, customersCreateSchema } from "./models";
import { importDataFromCSV } from "./utils";

const DB = new AWS.DynamoDB.DocumentClient();
const tableName = 'customersDB';

export const getCustomersHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    // Perform a Scan operation
    const customersParams = {
      TableName: tableName,
      FilterExpression: "#ss = :status",
      ExpressionAttributeNames: {
        "#ss": "security_status",
      },
      ExpressionAttributeValues: {
        ":status": "active",
      },
    };
    const customers = await DB.scan(customersParams).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(customers.Items),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};


export const getCustomerByIdHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {

    // Retrieve the customer from the database
    const customerParams = {
      TableName: tableName,
      Key: { id: event.pathParameters?.id },

    };
    const customer = await DB.get(customerParams).promise();

    if (!customer.Item || customer.Item.security_status !== 'active') {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Customer not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(customer.Item),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

export const createCustomerHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { error } = customerCreateSchema.validate(JSON.parse(event.body ? event.body : ''));
    if (error) {
      // Return a 400 Bad Request if the validation fails
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.details[0].message })
      }
    }

    const { name, email, address, phone_number, age, nic } = JSON.parse(event.body ? event.body : '');
    if (await isCustomerExists(nic)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Customer NIC already exists" })
      }
    }

    // Generate a unique customer ID
    const customerId = generateCustomerId();

    // Create a new customer in the database
    const customerParams = {
      TableName: tableName,
      Item: {
        id: customerId, name, nic, email, address, phone_number, age, security_status: 'active'
      },
    };
    await DB.put(customerParams).promise();

    // Return the newly created customer
    const createdCustomer = {
      id: customerId, name, email, nic, address, phone_number, age, security_status: 'active'
    };

    return {
      statusCode: 201,
      body: JSON.stringify(createdCustomer),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};


export const createCustomersFromCSVHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { fileName } = JSON.parse(event.body ? event.body : '');
    const bucketName = 'customer-api-csv';
    // const filePath = 'customerApiLambda.csv';
    const filePath = fileName;

    const csvData = await importDataFromCSV(bucketName, filePath);
    const { error } = customersCreateSchema.validate(csvData);
    if (error) {
      // Return a 400 Bad Request if the validation fails
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.details[0].message })
      }
    }

    // Create an array of promises for each database insertion
    const insertPromises = csvData.map(async (row: any) => {
      if (!(await isCustomerExists(row.nic))) {
        const customerId = generateCustomerId();
        return addRecordToDB({ id: customerId, security_status: "active", ...row });
      }
    });

    await Promise.all(insertPromises);


    console.log('Data imported successfully');

    return {
      statusCode: 201,
      body: JSON.stringify(csvData),

    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};



export const updateCustomerByIdHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { error } = customerUpdateSchema.validate(JSON.parse(event.body ? event.body : ''));
    if (error) {
      // Return a 400 Bad Request if the validation fails
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.details[0].message })
      }
    }
    // Retrieve the customer from the database
    const customerCheckParams = {
      TableName: tableName,
      Key: { id: event.pathParameters?.id },

    };
    const customer = await DB.get(customerCheckParams).promise();

    if (!customer.Item || customer.Item.security_status !== 'active') {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Customer not found' }),
      };
    }


    const requestBody = JSON.parse(event.body ? event.body : '');
    if (requestBody.nic && await isCustomerExists(requestBody.nic)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Customer NIC already exists" })
      }
    }

    const updateExpressionParts = [];
    const expressionAttributeValues: { [key: string]: any } = {};

    for (const key in requestBody) {
      updateExpressionParts.push(`#${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = requestBody[key];
    }
    const updateExpression = `SET ${updateExpressionParts.join(", ")}`;

    const expressionAttributeNames: { [key: string]: string } = {};
    for (const key in requestBody) {
      expressionAttributeNames[`#${key}`] = key;

    }

    // Update the customer in the database
    const customerParams = {
      TableName: tableName,
      Key: { id: event.pathParameters?.id },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    };

    const updatedCustomer = await DB.update(customerParams).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(updatedCustomer.Attributes),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};



export const deleteCustomerByIdHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {

    // Retrieve the customer from the database
    const customerParams = {
      TableName: tableName,
      Key: { id: event.pathParameters?.id },

    };
    const customer = await DB.get(customerParams).promise();

    if (!customer.Item || customer.Item.security_status !== 'active') {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Customer not found' }),
      };
    }
    await DB.delete(customerParams).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(customer.Item),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};



// Helper function to generate a unique customer ID
function generateCustomerId() {
  return uuidv4();
}

const isCustomerExists = async (nic: string) => {

  // Check if the username already exists
  const existingUserParams = {
    TableName: tableName,
    FilterExpression: '#nic = :nic',
    ExpressionAttributeNames: {
      '#nic': 'nic'
    },
    ExpressionAttributeValues: {
      ':nic': nic
    }
  };
  const existingUsers = await DB.scan(existingUserParams).promise();

  if (existingUsers.Items && existingUsers.Items.length > 0) {
    return true;
  }
  return false;
}



// Add this function to handle the database insertion
const addRecordToDB = async (row: any) => {
  const params = {
    TableName: tableName,
    Item: row
  };
  await DB.put(params).promise();
};

