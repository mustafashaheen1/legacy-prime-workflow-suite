import { createTRPCRouter } from "./create-context.js";
import hiRoute from "./routes/example/hi/route.js";
import { addPaymentProcedure } from "./routes/payments/add-payment/route.js";
import { getPaymentsProcedure } from "./routes/payments/get-payments/route.js";
import { addChangeOrderProcedure } from "./routes/change-orders/add-change-order/route.js";
import { getChangeOrdersProcedure } from "./routes/change-orders/get-change-orders/route.js";
import { updateChangeOrderProcedure } from "./routes/change-orders/update-change-order/route.js";
import { loginProcedure } from "./routes/auth/login/route.js";
import { sendVerificationCodeProcedure } from "./routes/auth/send-verification-code/route.js";
import { verifyCodeProcedure } from "./routes/auth/verify-code/route.js";
import { createUserProcedure } from "./routes/users/create-user/route.js";
import { getUsersProcedure } from "./routes/users/get-users/route.js";
import { updateUserProcedure } from "./routes/users/update-user/route.js";
import { deleteUserProcedure } from "./routes/users/delete-user/route.js";
import { requestRateChangeProcedure } from "./routes/users/request-rate-change/route.js";
import { approveRateChangeProcedure } from "./routes/users/approve-rate-change/route.js";
import { createCompanyProcedure } from "./routes/companies/create-company/route.js";
import { getCompaniesProcedure } from "./routes/companies/get-companies/route.js";
import { updateCompanyProcedure } from "./routes/companies/update-company/route.js";
import { sendSmsProcedure } from "./routes/twilio/send-sms/route.js";
import { makeCallProcedure } from "./routes/twilio/make-call/route.js";
import { getCallLogsProcedure } from "./routes/twilio/get-call-logs/route.js";
import { createVirtualAssistantProcedure } from "./routes/twilio/create-virtual-assistant/route.js";
import { sendBulkSmsProcedure } from "./routes/twilio/send-bulk-sms/route.js";
import { createSubcontractorProcedure } from "./routes/subcontractors/create-subcontractor/route.js";
import { getSubcontractorsProcedure } from "./routes/subcontractors/get-subcontractors/route.js";
import { updateSubcontractorProcedure } from "./routes/subcontractors/update-subcontractor/route.js";
import { requestEstimateProcedure } from "./routes/subcontractors/request-estimate/route.js";
import { submitProposalProcedure } from "./routes/subcontractors/submit-proposal/route.js";
import { getProposalsProcedure } from "./routes/subcontractors/get-proposals/route.js";
import { sendRegistrationLinkProcedure } from "./routes/subcontractors/send-registration-link/route.js";
import { completeRegistrationProcedure } from "./routes/subcontractors/complete-registration/route.js";
import { uploadBusinessFileProcedure } from "./routes/subcontractors/upload-business-file/route.js";
import { verifyBusinessFileProcedure } from "./routes/subcontractors/verify-business-file/route.js";
import { approveSubcontractorProcedure } from "./routes/subcontractors/approve-subcontractor/route.js";
import { getBusinessFilesProcedure } from "./routes/subcontractors/get-business-files/route.js";
import { getNotificationsProcedure } from "./routes/notifications/get-notifications/route.js";
import { markNotificationReadProcedure } from "./routes/notifications/mark-read/route.js";
import { chatCompletionProcedure } from "./routes/openai/chat/route.js";
import { speechToTextProcedure } from "./routes/openai/speech-to-text/route.js";
import { textToSpeechProcedure } from "./routes/openai/text-to-speech/route.js";
import { imageAnalysisProcedure } from "./routes/openai/image-analysis/route.js";
import { agentChatProcedure, agentToolResultProcedure } from "./routes/openai/agent-chat/route.js";
import { testConnectionProcedure } from "./routes/openai/test-connection/route.js";
import { getPhotosProcedure } from "./routes/photos/get-photos/route.js";
import { savePhotoMetadataProcedure } from "./routes/photos/save-photo-metadata/route.js";
import { getExpensesDetailedProcedure } from "./routes/expenses/get-expenses-detailed/route.js";
import { getClockEntriesProcedure } from "./routes/clock/get-clock-entries/route.js";
import { getTimecardProcedure } from "./routes/clock/get-timecard/route.js";
import { handleReceptionistCallProcedure } from "./routes/twilio/handle-receptionist-call/route.js";
import { sendInspectionLinkProcedure } from "./routes/crm/send-inspection-link/route.js";
import { submitInspectionDataProcedure } from "./routes/crm/submit-inspection-data/route.js";
import { addClientProcedure } from "./routes/crm/add-client/route.js";
import { getClientsProcedure } from "./routes/crm/get-clients/route.js";
import { updateClientProcedure } from "./routes/crm/update-client/route.js";
import { createInspectionVideoLinkProcedure } from "./routes/crm/create-inspection-video-link/route.js";
import { validateInspectionTokenProcedure } from "./routes/crm/validate-inspection-token/route.js";
import { getVideoUploadUrlProcedure } from "./routes/crm/get-video-upload-url/route.js";
import { completeVideoUploadProcedure } from "./routes/crm/complete-video-upload/route.js";
import { getInspectionVideosProcedure } from "./routes/crm/get-inspection-videos/route.js";
import { getVideoViewUrlProcedure } from "./routes/crm/get-video-view-url/route.js";
import { createPaymentIntentProcedure } from "./routes/stripe/create-payment-intent/route.js";
import { createSubscriptionProcedure } from "./routes/stripe/create-subscription/route.js";
import { verifyPaymentProcedure } from "./routes/stripe/verify-payment/route.js";
import { activateSubscriptionProcedure } from "./routes/stripe/activate-subscription/route.js";
import { getProjectCostsProcedure } from "./routes/projects/get-project-costs/route.js";
import { addProjectProcedure } from "./routes/projects/add-project/route.js";
import { getProjectsProcedure } from "./routes/projects/get-projects/route.js";
import { updateProjectProcedure } from "./routes/projects/update-project/route.js";
import { addExpenseProcedure } from "./routes/expenses/add-expense/route.js";
import { getExpensesProcedure } from "./routes/expenses/get-expenses/route.js";
import { clockInProcedure } from "./routes/clock/clock-in/route.js";
import { clockOutProcedure } from "./routes/clock/clock-out/route.js";
import { addPhotoProcedure } from "./routes/photos/add-photo/route.js";
import { addTaskProcedure } from "./routes/tasks/add-task/route.js";
import { updateTaskProcedure } from "./routes/tasks/update-task/route.js";
import { getTasksProcedure } from "./routes/tasks/get-tasks/route.js";
import { getPriceListProcedure } from "./routes/price-list/get-price-list/route.js";
import { getCategoriesProcedure } from "./routes/price-list/get-categories/route.js";
import { addPriceListItemProcedure } from "./routes/price-list/add-price-list-item/route.js";
import { updatePriceListItemProcedure } from "./routes/price-list/update-price-list-item/route.js";
import { createEstimateProcedure } from "./routes/estimates/create-estimate/route.js";
import { getEstimatesProcedure } from "./routes/estimates/get-estimates/route.js";
import { testEstimateProcedure } from "./routes/estimates/test-estimate/route.js";
import { getPhotoCategoriesProcedure } from "./routes/photo-categories/get-photo-categories/route.js";
import { addPhotoCategoryProcedure } from "./routes/photo-categories/add-photo-category/route.js";
import { updatePhotoCategoryProcedure } from "./routes/photo-categories/update-photo-category/route.js";
import { deletePhotoCategoryProcedure } from "./routes/photo-categories/delete-photo-category/route.js";
import { getScheduledTasksProcedure } from "./routes/scheduled-tasks/get-scheduled-tasks/route.js";
import { addScheduledTaskProcedure } from "./routes/scheduled-tasks/add-scheduled-task/route.js";
import { updateScheduledTaskProcedure } from "./routes/scheduled-tasks/update-scheduled-task/route.js";
import { deleteScheduledTaskProcedure } from "./routes/scheduled-tasks/delete-scheduled-task/route.js";
import { getCustomFoldersProcedure } from "./routes/custom-folders/get-custom-folders/route.js";
import { addCustomFolderProcedure } from "./routes/custom-folders/add-custom-folder/route.js";
import { deleteCustomFolderProcedure } from "./routes/custom-folders/delete-custom-folder/route.js";

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
    deleteUser: deleteUserProcedure,
    requestRateChange: requestRateChangeProcedure,
    approveRateChange: approveRateChangeProcedure,
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
    handleReceptionistCall: handleReceptionistCallProcedure,
  }),
  subcontractors: createTRPCRouter({
    createSubcontractor: createSubcontractorProcedure,
    getSubcontractors: getSubcontractorsProcedure,
    updateSubcontractor: updateSubcontractorProcedure,
    requestEstimate: requestEstimateProcedure,
    submitProposal: submitProposalProcedure,
    getProposals: getProposalsProcedure,
    sendRegistrationLink: sendRegistrationLinkProcedure,
    completeRegistration: completeRegistrationProcedure,
    uploadBusinessFile: uploadBusinessFileProcedure,
    verifyBusinessFile: verifyBusinessFileProcedure,
    approveSubcontractor: approveSubcontractorProcedure,
    getBusinessFiles: getBusinessFilesProcedure,
  }),
  notifications: createTRPCRouter({
    getNotifications: getNotificationsProcedure,
    markRead: markNotificationReadProcedure,
  }),
  openai: createTRPCRouter({
    chat: chatCompletionProcedure,
    speechToText: speechToTextProcedure,
    textToSpeech: textToSpeechProcedure,
    imageAnalysis: imageAnalysisProcedure,
    agentChat: agentChatProcedure,
    agentToolResult: agentToolResultProcedure,
    testConnection: testConnectionProcedure,
  }),
  photos: createTRPCRouter({
    addPhoto: addPhotoProcedure,
    getPhotos: getPhotosProcedure,
    savePhotoMetadata: savePhotoMetadataProcedure,
  }),
  expenses: createTRPCRouter({
    addExpense: addExpenseProcedure,
    getExpenses: getExpensesProcedure,
    getExpensesDetailed: getExpensesDetailedProcedure,
  }),
  clock: createTRPCRouter({
    clockIn: clockInProcedure,
    clockOut: clockOutProcedure,
    getClockEntries: getClockEntriesProcedure,
    getTimecard: getTimecardProcedure,
  }),
  tasks: createTRPCRouter({
    addTask: addTaskProcedure,
    updateTask: updateTaskProcedure,
    getTasks: getTasksProcedure,
  }),
  crm: createTRPCRouter({
    addClient: addClientProcedure,
    getClients: getClientsProcedure,
    updateClient: updateClientProcedure,
    sendInspectionLink: sendInspectionLinkProcedure,
    submitInspectionData: submitInspectionDataProcedure,
    createInspectionVideoLink: createInspectionVideoLinkProcedure,
    validateInspectionToken: validateInspectionTokenProcedure,
    getVideoUploadUrl: getVideoUploadUrlProcedure,
    completeVideoUpload: completeVideoUploadProcedure,
    getInspectionVideos: getInspectionVideosProcedure,
    getVideoViewUrl: getVideoViewUrlProcedure,
  }),
  stripe: createTRPCRouter({
    createPaymentIntent: createPaymentIntentProcedure,
    createSubscription: createSubscriptionProcedure,
    verifyPayment: verifyPaymentProcedure,
    activateSubscription: activateSubscriptionProcedure,
  }),
  projects: createTRPCRouter({
    addProject: addProjectProcedure,
    getProjects: getProjectsProcedure,
    updateProject: updateProjectProcedure,
    getProjectCosts: getProjectCostsProcedure,
  }),
  priceList: createTRPCRouter({
    getPriceList: getPriceListProcedure,
    getCategories: getCategoriesProcedure,
    addPriceListItem: addPriceListItemProcedure,
    updatePriceListItem: updatePriceListItemProcedure,
  }),
  estimates: createTRPCRouter({
    createEstimate: createEstimateProcedure,
    getEstimates: getEstimatesProcedure,
    testEstimate: testEstimateProcedure,
  }),
  photoCategories: createTRPCRouter({
    getPhotoCategories: getPhotoCategoriesProcedure,
    addPhotoCategory: addPhotoCategoryProcedure,
    updatePhotoCategory: updatePhotoCategoryProcedure,
    deletePhotoCategory: deletePhotoCategoryProcedure,
  }),
  scheduledTasks: createTRPCRouter({
    getScheduledTasks: getScheduledTasksProcedure,
    addScheduledTask: addScheduledTaskProcedure,
    updateScheduledTask: updateScheduledTaskProcedure,
    deleteScheduledTask: deleteScheduledTaskProcedure,
  }),
  customFolders: createTRPCRouter({
    getCustomFolders: getCustomFoldersProcedure,
    addCustomFolder: addCustomFolderProcedure,
    deleteCustomFolder: deleteCustomFolderProcedure,
  }),
});

export type AppRouter = typeof appRouter;
