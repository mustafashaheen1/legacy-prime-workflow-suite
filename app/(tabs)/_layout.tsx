import { Tabs } from "expo-router";
import { LayoutDashboard, Users, Clock, DollarSign, Camera, Calendar, MessageSquare } from "lucide-react-native";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: true,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <LayoutDashboard size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: "CRM",
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clock"
        options={{
          title: "Clock",
          tabBarIcon: ({ color }) => <Clock size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color }) => <DollarSign size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: "Photos",
          tabBarIcon: ({ color }) => <Camera size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          headerShown: false,
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
