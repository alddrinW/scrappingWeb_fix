import { FileText, Gavel, Building2, Receipt, UserX, Heart, Scale, GraduationCap, Shield } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Fade, Grow } from "@mui/material";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const menuItems: MenuItem[] = [
  { title: "Datos IESS", url: "/datos-iess", icon: FileText },
  { title: "Citaciones ANT", url: "/citaciones-ant", icon: FileText },
  { title: "Citación Judicial", url: "/citacion-judicial", icon: Gavel },
  { title: "Consejo Judicatura", url: "/consejo-judicatura", icon: Building2 },
  { title: "Consulta SRI", url: "/consulta-sri", icon: Receipt },
  { title: "SRI Deudas", url: "/sri-deudas", icon: Receipt },
  { title: "Impedimentos Cargos Públicos", url: "/impedimentos-cargos", icon: UserX },
  { title: "Pensión Alimenticia", url: "/pension-alimenticia", icon: Heart },
  { title: "Procesos Judiciales", url: "/procesos-judiciales", icon: Scale },
  { title: "Senescyt", url: "/senescyt", icon: GraduationCap },
  { title: "Super CIAS", url: "/supercias", icon: Building2 },
  { title: "Interpol", url: "/interpol", icon: FileText },
  { title: "Antecedentes Penales", url: "/antecedentes-penales", icon: Shield },
];

export function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <Sidebar className="bg-[#5F40E2] text-black w-64 h-screen shadow-lg">
      <SidebarHeader>
        <div className="px-4 py-4 border-b border-gray-400">
          <Fade in timeout={600}>
            <h2 className="text-lg font-bold tracking-tight text-black">Sistema Scraping</h2>
          </Fade>
          <Fade in timeout={800}>
            <p className="text-sm text-gray-800 mt-1">Consultas y verificaciones</p>
          </Fade>
        </div>
      </SidebarHeader>
      <SidebarContent className="flex-1 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold text-gray-800 uppercase tracking-wider mb-3">
            Consultas Disponibles
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => (
                <SidebarMenuItem key={item.title}>
                  <Grow in timeout={300 + index * 50}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 ease-in-out group
                        ${pathname === item.url
                          ? "bg-gradient-to-r from-[#6B5BFF] to-[#33D1FF] text-black scale-105 shadow-md"
                          : "text-black hover:bg-[#4B3ABF] hover:text-black hover:scale-102"
                        }`}
                    >
                      <Link to={item.url}>
                        <item.icon
                          className={`mr-3 h-5 w-5 ${
                            pathname === item.url ? "text-black" : "text-gray-600 group-hover:text-[#00C3F5]"
                          }`}
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </Grow>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}