import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/MainLayout";
import { KDSProvider } from "@/context/KDSContext";
import { FOHProvider } from "@/context/FOHContext";
import { CRMProvider } from "@/context/CRMContext";
import { AccountsProvider } from "@/context/AccountsContext";
import { InventoryProvider } from "@/context/InventoryContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { RoleProvider } from "@/context/RoleContext";
import { AuditProvider } from "@/context/AuditContext";
import { ClockProvider } from "@/context/ClockContext";
import { AuthGate } from "@/components/AuthGate";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate>
        <SettingsProvider>
          <RoleProvider>
            <AuditProvider>
              <KDSProvider>
                <AccountsProvider>
                  <InventoryProvider>
                    <CRMProvider>
                      <FOHProvider>
                        <ClockProvider>
                          <MainLayout />
                        </ClockProvider>
                      </FOHProvider>
                    </CRMProvider>
                  </InventoryProvider>
                </AccountsProvider>
              </KDSProvider>
            </AuditProvider>
          </RoleProvider>
        </SettingsProvider>
        </AuthGate>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
