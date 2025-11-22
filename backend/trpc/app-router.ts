import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { addPaymentProcedure } from "./routes/payments/add-payment/route";
import { getPaymentsProcedure } from "./routes/payments/get-payments/route";
import { addChangeOrderProcedure } from "./routes/change-orders/add-change-order/route";
import { getChangeOrdersProcedure } from "./routes/change-orders/get-change-orders/route";
import { updateChangeOrderProcedure } from "./routes/change-orders/update-change-order/route";
import { loginProcedure } from "./routes/auth/login/route";
import { sendVerificationCodeProcedure } from "./routes/auth/send-verification-code/route";
import { verifyCodeProcedure } from "./routes/auth/verify-code/route";
import { createUserProcedure } from "./routes/users/create-user/route";
import { getUsersProcedure } from "./routes/users/get-users/route";
import { updateUserProcedure } from "./routes/users/update-user/route";
import { createCompanyProcedure } from "./routes/companies/create-company/route";
import { getCompaniesProcedure } from "./routes/companies/get-companies/route";
import { updateCompanyProcedure } from "./routes/companies/update-company/route";
import { sendSmsProcedure } from "./routes/twilio/send-sms/route";
import { makeCallProcedure } from "./routes/twilio/make-call/route";
import { getCallLogsProcedure } from "./routes/twilio/get-call-logs/route";
import { createVirtualAssistantProcedure } from "./routes/twilio/create-virtual-assistant/route";
import { sendBulkSmsProcedure } from "./routes/twilio/send-bulk-sms/route";
import { createSubcontractorProcedure } from "./routes/subcontractors/create-subcontractor/route";
import { getSubcontractorsProcedure } from "./routes/subcontractors/get-subcontractors/route";
import { updateSubcontractorProcedure } from "./routes/subcontractors/update-subcontractor/route";
import { requestEstimateProcedure } from "./routes/subcontractors/request-estimate/route";
import { submitProposalProcedure } from "./routes/subcontractors/submit-proposal/route";
import { getProposalsProcedure } from "./routes/subcontractors/get-proposals/route";
import { getNotificationsProcedure } from "./routes/notifications/get-notifications/route";
import { markNotificationReadProcedure } from "./routes/notifications/mark-read/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  auth: createTRPCRouter({
    login: loginProcedure,
    sendVerificationCode: sendVerificationCodeProcedure,
    verifyCode: verifyCodeProcedure,
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
  twilio: createTRPCRouter({
    sendSms: sendSmsProcedure,
    makeCall: makeCallProcedure,
    getCallLogs: getCallLogsProcedure,
    createVirtualAssistant: createVirtualAssistantProcedure,
    sendBulkSms: sendBulkSmsProcedure,
  }),
  subcontractors: createTRPCRouter({
    createSubcontractor: createSubcontractorProcedure,
    getSubcontractors: getSubcontractorsProcedure,
    updateSubcontractor: updateSubcontractorProcedure,
    requestEstimate: requestEstimateProcedure,
    submitProposal: submitProposalProcedure,
    getProposals: getProposalsProcedure,
  }),
  notifications: createTRPCRouter({
    getNotifications: getNotificationsProcedure,
    markRead: markNotificationReadProcedure,
  }),
});

export type AppRouter = typeof appRouter;
