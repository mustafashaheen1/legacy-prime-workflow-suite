import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { addPaymentProcedure } from "./routes/payments/add-payment/route";
import { getPaymentsProcedure } from "./routes/payments/get-payments/route";
import { addChangeOrderProcedure } from "./routes/change-orders/add-change-order/route";
import { getChangeOrdersProcedure } from "./routes/change-orders/get-change-orders/route";
import { updateChangeOrderProcedure } from "./routes/change-orders/update-change-order/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  payments: createTRPCRouter({
    addPayment: addPaymentProcedure,
    getPayments: getPaymentsProcedure,
  }),
  changeOrders: createTRPCRouter({
    addChangeOrder: addChangeOrderProcedure,
    getChangeOrders: getChangeOrdersProcedure,
    updateChangeOrder: updateChangeOrderProcedure,
  }),
});

export type AppRouter = typeof appRouter;
