import Joi, { Schema } from 'joi';

const customerCreateSchema: Schema = Joi.object({
  nic:Joi.string().required().min(10).max(20),
  name: Joi.string().required().min(4).max(20),
  age: Joi.number().required(),
  email: Joi.string().required().email(),
  address: Joi.string().required().min(10).max(50),
  phone_number: Joi.string().required().
    pattern(/^[0-9]{9,10}$/), // Specify the desired pattern for the mobile number, 
});

const customerUpdateSchema: Schema = Joi.object({
  nic:Joi.string(),
  name: Joi.string().min(4).max(20),
  age: Joi.number(),
  email: Joi.string().email(),
  address: Joi.string().min(10).max(50),
  phone_number: Joi.string().
    pattern(/^[0-9]{9,10}$/), // Specify the desired pattern for the mobile number,  
});

const customersCreateSchema: Schema = Joi.array().items(customerCreateSchema);

export {
  customerCreateSchema,customersCreateSchema,customerUpdateSchema
};
