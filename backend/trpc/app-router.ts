import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { addPaymentProcedure } from "./routes/payments/add-payment/route";
import { getPaymentsProcedure } from "./routes/payments/get-payments/route";
import { addChangeOrderProcedure } from "./routes/change-orders/add-change-order/route";
import { getChangeOrdersProcedure } from "./routes/change-orders/get-change-orders/route";
import { updateChangeOrderProcedure } from "./routes/change-orders/update-change-order/route";
import { loginProcedure } from "./routes/auth/login/route";
import { createUserProcedure } from "./routes/users/create-user/route";
import { getUsersProcedure } from "./routes/users/get-users/route";
import { updateUserProcedure } from "./routes/users/update-user/route";
import { createCompanyProcedure } from "./routes/companies/create-company/route";
import { getCompaniesProcedure } from "./routes/companies/get-companies/route";
import { updateCompanyProcedure } from "./routes/companies/update-company/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  auth: createTRPCRouter({
    login: loginProcedure,
  }),
  users: createTRPCRouter({
    createUser: createUserProcedure,
    getUsers: getUsersProcedure,
    updateUser: updateUserProcedure,
  }),
  companies: createTRPCRouter({
    createCompany: createCompanyProcedure,
    getCompanies: getCompaniesProcedure,
    updateCompany: updateCompanyProcedure,
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
