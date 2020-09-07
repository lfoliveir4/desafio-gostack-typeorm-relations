import { inject, injectable } from "tsyringe";

import AppError from "@shared/errors/AppError";

import IProductsRepository from "@modules/products/repositories/IProductsRepository";
import ICustomersRepository from "@modules/customers/repositories/ICustomersRepository";
import Order from "../infra/typeorm/entities/Order";
import IOrdersRepository from "../repositories/IOrdersRepository";

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject("OrdersRepository")
    private ordersRepository: IOrdersRepository,
    @inject("ProductsRepository")
    private productsRepository: IProductsRepository,
    @inject("CustomersRepository")
    private customersRepository: ICustomersRepository
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExistis = await this.customersRepository.findById(
      customer_id
    );

    if (!customerExistis) {
      throw new AppError("Could not a find any customer with the given id");
    }

    const existentProducts = await this.productsRepository.findAllById(
      products
    );

    if (!existentProducts.length) {
      throw new AppError("could not fund any products with the given ids");
    }

    const existentProductsIds = existentProducts.map((product) => product.id);

    const checkInexistentProducts = products.filter(
      (product) => !existentProductsIds.includes(product.id)
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find product ${checkInexistentProducts[0].id}`
      );
    }

    const findProductsWithNoQuantityAvailable = products.filter(
      (product) =>
        existentProducts.filter((p) => p.id === product.id)[0].quantity <
        product.quantity
    );

    if (findProductsWithNoQuantityAvailable.length) {
      throw new AppError(
        `The quantity ${findProductsWithNoQuantityAvailable[0].quantity} is not avaible for ${findProductsWithNoQuantityAvailable[0].id}`
      );
    }

    const serializedProducts = products.map((product) => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter((p) => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExistis,
      products: serializedProducts,
    });

    const orderedProductsQuantity = products.map((product) => ({
      id: product.id,
      quantity:
        existentProducts.filter((p) => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
