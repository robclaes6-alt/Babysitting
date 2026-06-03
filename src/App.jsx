import { useState, useEffect } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────
const HOURLY_RATE_OLD = 15;
const HOURLY_RATE_NEW = 20;
const RATE_CHANGE_DATE = new Date("2025-09-01");
const AIRPORTS = { Brussels: { km: 95, earned: 80 }, Charleroi: { km: 226, earned: 120 }, Eindhoven: { km: 170, earned: 120 } };
const FUEL_PER_KM = 0.111408;

function serialToDate(s) { return new Date(new Date("1899-12-30").getTime() + s * 86400000); }
function fmtDate(d) { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function fmtEuro(n) { return "€" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function rateForDate(d) { return new Date(d) >= RATE_CHANGE_DATE ? HOURLY_RATE_NEW : HOURLY_RATE_OLD; }
function today() { return new Date().toISOString().split("T")[0]; }
function fmtTime(frac) { const t = Math.round(frac * 24 * 60); return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; }
function parseTime(t) { const [h,m] = t.split(":").map(Number); return (h*60+m)/(24*60); }

// ── seed data ─────────────────────────────────────────────────────────────────
// Sessions: [date, startTime, endTime, parking, other, earned]
const SEED_SESSIONS = [
  ["2025-01-06","16:30","20:00",0,0.78,52.5],
  ["2025-01-07","16:30","20:20",0,0.78,57.5],
  ["2025-01-09","16:30","21:00",7.4,0.78,67.5],
  ["2025-01-10","15:10","21:30",2,0.78,95],
  ["2025-01-13","16:30","19:00",2.6,0.78,37.5],
  ["2025-01-14","16:30","21:00",0,3.57,67.5],
  ["2025-01-15","14:15","16:50",0,0.78,38.75],
  ["2025-01-16","16:30","20:00",5.7,0.78,52.5],
  ["2025-01-17","15:10","20:00",2.6,117.53,72.5],
  ["2025-01-20","16:20","20:20",0,0.78,60],
  ["2025-01-21","16:20","20:00",0,13.57,55],
  ["2025-01-23","16:20","20:00",8,0.78,55],
  ["2025-01-24","15:10","21:00",0,0.78,87.5],
  ["2025-01-27","16:20","21:00",3,80.48,70],
  ["2025-01-28","16:20","19:20",0,15.97,45],
  ["2025-01-29","12:20","20:30",0,36.23,122.5],
  ["2025-01-30","16:20","23:00",0,79.78,100],
  ["2025-01-31","15:00","22:30",0,0.78,112.5],
  ["2025-02-03","16:20","20:30",0,20.78,62.5],
  ["2025-02-04","16:20","20:00",2.5,74.57,55],
  ["2025-02-05","14:00","20:30",0,18.9,97.5],
  ["2025-02-06","16:20","21:30",9,0.78,77.5],
  ["2025-02-07","15:00","21:20",0,0.78,95],
  ["2025-02-10","16:20","21:10",0,0.78,72.5],
  ["2025-02-11","16:20","21:20",0,63.57,75],
  ["2025-02-12","14:30","21:00",0,2.9,97.5],
  ["2025-02-13","16:20","20:20",0,20.78,60],
  ["2025-02-14","15:10","22:00",0,0.78,102.5],
  ["2025-02-17","16:20","20:20",0,0.78,60],
  ["2025-02-18","16:20","20:40",0,3.57,65],
  ["2025-02-20","16:20","20:50",3,0.78,67.5],
  ["2025-02-21","15:20","17:30",0,0.78,32.5],
  ["2025-02-24","16:20","20:00",0,0.78,55],
  ["2025-02-25","16:20","21:10",0,6.57,72.5],
  ["2025-02-27","16:20","20:40",0,0.78,65],
  ["2025-03-03","14:00","20:30",2,9.9,97.5],
  ["2025-03-04","10:00","20:30",2,3.57,157.5],
  ["2025-03-14","15:00","20:00",0,0.78,75],
  ["2025-03-17","16:20","21:00",0,50.78,70],
  ["2025-03-18","13:30","21:00",0,2.12,112.5],
  ["2025-03-19","16:20","21:00",0,0.78,70],
  ["2025-03-20","15:15","18:10",9,0.78,43.75],
  ["2025-03-24","16:20","20:30",0,11.78,62.5],
  ["2025-03-25","16:20","20:40",0,6.57,65],
  ["2025-03-26","12:20","20:40",0,104.12,125],
  ["2025-03-27","16:20","21:00",3,0.78,70],
  ["2025-03-28","15:10","18:30",10,0.78,50],
  ["2025-03-29","11:30","15:00",0,25.78,52.5],
  ["2025-03-31","16:20","22:00",0,0.78,85],
  ["2025-04-01","16:20","21:30",0,52.78,77.5],
  ["2025-04-02","12:10","20:50",0,46.12,130],
  ["2025-04-03","15:50","20:20",0,9.78,67.5],
  ["2025-04-21","12:00","19:15",0,12.23,108.75],
  ["2025-04-23","12:20","18:20",0,22.9,90],
  ["2025-04-24","16:20","21:20",0,0.78,75],
  ["2025-04-25","15:10","20:00",0,0.78,72.5],
  ["2025-04-28","12:00","12:40",0,0,10],
  ["2025-05-01","10:50","12:00",0,0,17.5],
  ["2025-05-05","16:20","20:30",3,0.78,62.5],
  ["2025-05-06","16:20","20:30",0,8.12,62.5],
  ["2025-05-07","12:00","20:00",2,64.63,120],
  ["2025-05-08","16:20","20:50",0,0.78,67.5],
  ["2025-05-09","14:50","21:20",0,0.78,97.5],
  ["2025-05-12","15:00","21:30",0,0.78,97.5],
  ["2025-05-13","16:20","22:00",0,80.12,85],
  ["2025-05-14","12:00","20:10",0,91.23,122.5],
  ["2025-05-15","16:20","21:20",0,0,75],
  ["2025-05-16","15:00","21:30",10,7.78,97.5],
  ["2025-05-19","15:00","20:40",0,0.78,85],
  ["2025-05-20","16:15","21:10",0,4.12,73.75],
  ["2025-05-21","12:00","20:00",0,3.9,120],
  ["2025-05-22","07:30","08:50",0,1.56,20],
  ["2025-05-22","16:00","20:30",5,15.01,67.5],
  ["2025-05-23","15:00","18:30",0,2.23,52.5],
  ["2025-05-26","15:00","21:40",0,0.78,100],
  ["2025-05-27","16:20","21:30",0,3.34,77.5],
  ["2025-06-03","16:20","20:40",0,2.12,65],
  ["2025-06-04","11:45","19:40",0,17.57,118.75],
  ["2025-06-05","16:00","21:00",6,17.56,75],
  ["2025-06-06","15:00","20:20",0,31,80],
  ["2025-06-09","10:10","21:20",0,0,167.5],
  ["2025-06-10","16:20","22:15",0,2.79,88.75],
  ["2025-06-11","12:00","21:20",0,133.8,140],
  ["2025-06-12","16:20","21:30",0,16.56,77.5],
  ["2025-06-13","14:40","19:40",0,3.34,75],
  ["2025-06-16","15:00","21:40",0,99.23,100],
  ["2025-06-17","16:20","21:30",0,0,77.5],
  ["2025-06-18","13:00","19:00",0,101.34,90],
  ["2025-06-19","16:00","20:30",0,10,67.5],
  ["2025-06-20","15:00","20:40",0,0,85],
  ["2025-06-23","15:00","22:00",0,1.56,105],
  ["2025-06-24","15:00","21:30",0,109.23,97.5],
  ["2025-06-25","09:00","21:30",0,3.34,187.5],
  ["2025-06-26","09:00","22:00",0,30.57,195],
  ["2025-06-27","11:00","19:50",0,20.57,132.5],
  ["2025-06-30","09:00","20:30",5,7.8,172.5],
  ["2025-07-01","10:00","20:00",0,3.57,150],
  ["2025-07-02","10:40","19:30",0,4.46,132.5],
  ["2025-07-03","10:40","21:20",0,2.23,160],
  ["2025-07-04","09:40","18:00",5,0,125],
  ["2025-08-04","11:00","13:30",0,10.23,37.5],
  ["2025-08-04","14:45","18:10",0,0,51.25],
  ["2025-08-05","10:00","18:30",0,16.46,127.5],
  ["2025-08-06","13:00","14:30",0,2.23,22.5],
  ["2025-08-18","10:00","13:20",0,2.23,50],
  ["2025-08-19","10:00","18:30",0,2.23,127.5],
  ["2025-08-21","10:00","18:30",0,13.37,127.5],
  ["2025-08-22","11:00","18:00",23,0,105],
  ["2025-08-25","10:00","19:00",0,4.46,135],
  ["2025-08-26","11:30","18:10",0,2.79,100],
  ["2025-08-28","14:20","20:00",0,4.46,85],
  ["2025-08-29","15:15","19:10",0,4.23,58.75],
  ["2025-09-01","16:20","20:30",4,1.78,62.5],
  ["2025-09-02","15:45","20:05",0,0,65],
  ["2025-09-03","15:45","20:00",0,0,63.75],
  ["2025-09-04","15:15","21:00",0,0,86.25],
  ["2025-09-05","15:10","21:15",0,26,121.67],
  ["2025-09-08","15:30","20:50",2.6,0,106.67],
  ["2025-09-09","16:20","20:20",0,0,80],
  ["2025-09-10","16:30","20:00",0,0,70],
  ["2025-09-11","16:20","21:30",0,0,103.33],
  ["2025-09-12","16:20","20:30",0,0,83.33],
  ["2025-09-15","14:50","20:00",3,0,103.33],
  ["2025-09-16","16:30","21:00",0,0,90],
  ["2025-09-17","16:20","21:20",4,0,100],
  ["2025-09-18","16:20","20:50",0,0,90],
  ["2025-09-19","14:50","19:00",0,0,83.33],
  ["2025-09-22","12:50","18:30",0,0,113.33],
  ["2025-09-23","16:20","21:50",0,0,110],
  ["2025-09-24","16:20","20:40",3,0,86.67],
  ["2025-09-25","16:20","22:00",0,0,113.33],
  ["2025-09-26","11:30","12:30",0,0,20],
  ["2025-09-29","16:00","20:40",0,0,93.33],
  ["2025-09-30","15:45","21:00",0,0,105],
  ["2025-10-01","16:20","19:00",0,0,53.33],
  ["2025-10-02","07:30","08:30",0,0,20],
  ["2025-10-02","16:00","19:00",0,0,60],
  ["2025-10-03","15:00","19:00",0,0,80],
  ["2025-10-06","15:00","20:00",0,0,100],
  ["2025-10-07","16:20","21:20",0,0,100],
  ["2025-10-08","14:30","20:10",6,0,113.33],
  ["2025-10-09","16:20","19:30",0,0,63.33],
  ["2025-10-10","15:00","20:30",0,0,110],
  ["2025-10-13","15:00","17:30",0,58,50],
  ["2025-10-15","16:20","20:50",1.5,13.5,90],
  ["2025-10-16","16:20","21:00",0,0,93.33],
  ["2025-10-17","15:00","16:40",0,0,33.33],
  ["2025-10-20","15:00","20:10",0,0,103.33],
  ["2025-10-21","16:20","20:30",0,0,83.33],
  ["2025-10-22","16:20","20:30",3,0,83.33],
  ["2025-11-03","15:00","20:30",0,0,110],
  ["2025-11-04","16:20","20:00",0,0,73.33],
  ["2025-11-05","16:20","20:30",3.6,0,83.33],
  ["2025-11-06","15:45","21:00",0,2.5,105],
  ["2025-11-07","15:00","18:00",0,0,60],
  ["2025-11-10","15:00","21:00",0,0,120],
  ["2025-11-11","11:00","17:30",0,0,130],
  ["2025-11-12","16:20","20:45",0,0,88.33],
  ["2025-11-14","14:20","20:30",0,0,123.33],
  ["2025-11-17","14:40","20:45",0,0,121.67],
  ["2025-11-18","16:20","20:50",0,0,90],
  ["2025-11-19","15:00","22:30",4.6,0,150],
  ["2025-11-20","16:20","20:40",0,0,86.67],
  ["2025-11-21","15:00","19:00",2,65,80],
  ["2025-11-24","15:00","19:15",0,70,85],
  ["2025-11-25","16:15","19:30",0,0,65],
  ["2025-11-26","15:00","18:00",2.7,0,60],
  ["2025-11-27","16:10","21:00",0,0,96.67],
  ["2025-11-28","15:00","17:30",0,0,50],
  ["2025-12-02","16:20","20:00",0,0,73.33],
  ["2025-12-03","14:50","20:30",0,0,113.33],
  ["2025-12-05","15:10","21:00",0,0,116.67],
  ["2025-12-08","13:40","20:00",0,0,126.67],
  ["2025-12-09","07:30","08:45",0,0,25],
  ["2025-12-09","16:20","21:00",0,0,93.33],
  ["2025-12-10","15:00","20:00",0,0,100],
  ["2025-12-11","07:30","08:30",0,0,20],
  ["2025-12-11","16:15","19:30",0,0,65],
  ["2025-12-12","10:00","18:15",0,0,165],
  ["2025-12-15","14:10","19:30",0,0,106.67],
  ["2025-12-16","10:15","17:15",0,0,140],
  ["2025-12-17","10:50","18:00",0,0,143.33],
  ["2026-01-06","16:15","21:00",0,14.8,95],
  ["2026-01-07","14:50","20:00",0,0,103.33],
  ["2026-01-08","16:15","20:00",0,0,75],
  ["2026-01-09","14:50","21:15",0,0,128.33],
  ["2026-01-12","15:00","21:30",0,0,130],
  ["2026-01-13","16:20","21:10",0,0,96.67],
  ["2026-01-14","15:00","21:00",4.5,0,120],
  ["2026-01-15","16:20","20:40",0,0,86.67],
  ["2026-01-16","15:00","20:00",0,0,100],
  ["2026-01-19","13:30","20:30",0,0,140],
  ["2026-01-20","07:30","09:00",0,0,30],
  ["2026-01-20","16:20","20:30",0,0,83.33],
  ["2026-01-22","16:15","20:30",0,0,85],
  ["2026-01-23","15:00","19:00",0,0,80],
  ["2026-01-26","15:00","20:45",0,0,115],
  ["2026-01-27","16:10","20:30",20,0,86.67],
  ["2026-01-28","15:00","21:00",1.4,0,120],
  ["2026-01-29","16:15","21:00",0,20,95],
  ["2026-01-30","15:00","19:30",0,0,90],
  ["2026-02-02","12:40","20:20",0,0,153.33],
  ["2026-02-03","16:40","20:45",0,0,81.67],
  ["2026-02-04","15:00","18:10",2.2,0,63.33],
  ["2026-02-05","18:00","21:00",0,0,60],
  ["2026-02-06","15:00","21:10",0,50,123.33],
  ["2026-02-09","15:00","19:45",0,0,95],
  ["2026-02-10","16:15","21:10",3,0,98.33],
  ["2026-02-11","15:00","20:20",0,0,106.67],
  ["2026-02-12","16:15","21:00",0,0,95],
  ["2026-02-25","15:00","20:30",0,0,110],
  ["2026-02-26","16:15","20:45",0,0,90],
  ["2026-02-27","15:00","18:40",0,0,73.33],
  ["2026-03-02","15:00","21:15",0,0,125],
  ["2026-03-03","16:10","21:00",0,0,96.67],
  ["2026-03-04","15:00","21:30",0,0,130],
  ["2026-03-05","16:10","21:30",0,0,106.67],
  ["2026-03-06","08:15","09:05",0,0,16.67],
  ["2026-03-06","15:00","20:10",0,0,103.33],
  ["2026-03-09","15:00","21:00",0,0,120],
  ["2026-03-10","16:10","21:30",0,0,106.67],
  ["2026-03-11","15:00","20:45",0,0,115],
  ["2026-03-12","16:10","20:35",0,0,88.33],
  ["2026-03-13","15:00","17:05",0,0,41.67],
  ["2026-03-16","15:00","20:50",0,0,116.67],
  ["2026-03-17","15:00","21:30",0,0,130],
  ["2026-03-18","15:00","20:30",0,0,110],
  ["2026-03-19","15:00","21:30",0,0,130],
  ["2026-03-20","15:00","18:10",0,0,63.33],
  ["2026-03-23","09:00","13:00",0,0,80],
  ["2026-03-23","15:00","20:15",0,0,105],
  ["2026-03-24","09:00","20:50",0,0,236.67],
  ["2026-03-25","16:10","19:30",0,0,66.67],
  ["2026-03-27","15:00","17:50",0,0,56.67],
  ["2026-04-02","11:40","13:00",0,0,26.67],
  ["2026-04-03","12:00","17:30",0,0,110],
  ["2026-04-07","10:11","12:55",0,0,54.67],
  ["2026-04-07","13:30","17:50",0,0,86.67],
  ["2026-04-08","12:40","17:10",0,0,90],
  ["2026-04-10","13:45","18:00",0,0,85],
  ["2026-04-13","15:00","21:00",0,25,120],
  ["2026-04-14","15:00","21:00",0,0,120],
  ["2026-04-15","07:30","08:30",0,0,20],
  ["2026-04-15","16:10","21:40",0,11.5,110],
  ["2026-04-16","16:10","21:30",0,0,106.67],
  ["2026-04-17","15:00","19:45",0,0,95],
  ["2026-04-20","15:00","20:30",0,0,110],
  ["2026-05-11","15:00","21:30",0,0,130],
  ["2026-05-12","11:20","21:30",0,78,203.33],
  ["2026-05-13","16:10","22:00",0,52,116.67],
  ["2026-05-14","10:00","21:45",0,0,235],
  ["2026-05-15","09:00","18:45",0,0,195],
  ["2026-05-18","15:00","21:00",0,0,120],
  ["2026-05-19","15:00","21:00",0,0,120],
  ["2026-05-20","16:15","21:20",0,0,101.67],
  ["2026-05-21","16:15","21:30",0,0,105],
  ["2026-05-27","16:15","21:30",0,0,105],
  ["2026-05-28","16:15","21:10",0,0,98.33],
  ["2026-05-29","15:00","20:10",0,0,103.33],
  ["2026-06-01","15:00","21:40",13,0,133.33],
];
// Airports: [date, airport, parking, earned]
const SEED_AIRPORTS = [
  ["2025-01-06","Charleroi",3,145.18],
  ["2025-01-09","Brussels",0,90.58],
  ["2025-01-09","Charleroi",3,145.18],
  ["2025-01-09","Brussels",5,90.58],
  ["2025-01-13","Brussels",0,90.58],
  ["2025-01-15","Brussels",0,90.58],
  ["2025-01-24","Brussels",0,90.58],
  ["2025-02-02","Brussels",0,90.58],
  ["2025-02-09","Charleroi",3,145.18],
  ["2025-02-09","Brussels",5,90.58],
  ["2025-02-13","Eindhoven",0,138.94],
  ["2025-02-16","Charleroi",6,145.18],
  ["2025-04-04","Charleroi",0,145.18],
  ["2025-04-26","Brussels",0,90.58],
  ["2025-05-09","Brussels",0,90.58],
  ["2025-05-18","Charleroi",0,145.18],
  ["2025-05-28","Charleroi",0,145.18],
  ["2025-08-06","Brussels",0,90.58],
  ["2025-09-05","Brussels",0,90.58],
  ["2025-09-24","Charleroi",0,145.18],
  ["2025-10-01","Charleroi",0,145.18],
  ["2025-11-19","Brussels",0,90.58],
  ["2025-11-24","Charleroi",0,145.18],
  ["2025-12-05","Brussels",0,90.58],
  ["2026-01-09","Brussels",0,90.58],
  ["2026-01-21","Brussels",0,90.58],
  ["2026-02-12","Brussels",0,90.58],
  ["2026-02-13","Brussels",12,90.58],
  ["2026-03-13","Brussels",0,90.58],
  ["2026-03-25","Brussels",0,90.58],
  ["2026-04-01","Brussels",0,90.58],
  ["2026-04-10","Brussels",0,90.58],
];
const SEED_PAYMENTS = [
  ["2025-01-13",500],["2025-01-21",620],["2025-01-23",320],["2025-01-29",900],
  ["2025-02-07",430],["2025-02-10",500],["2025-02-20",800],
  ["2025-03-04",600],["2025-03-25",650],
  ["2025-04-03",1050],["2025-04-26",450],
  ["2025-05-14",1100],["2025-05-27",1150],
  ["2025-06-10",650],["2025-06-27",2000],
  ["2025-07-04",700],
  ["2025-09-01",1300],["2025-09-15",800],["2025-09-24",1000],
  ["2025-10-08",1000],["2025-10-20",650],
  ["2025-11-12",900],["2025-11-26",1200],
  ["2025-12-20",1600],
  ["2026-01-16",1000],
  ["2026-02-04",778],["2026-02-12",1430],
  ["2026-03-05",740],["2026-03-12",600],
  ["2026-04-01",1300],["2026-04-20",1300],
  ["2026-05-05",840],["2026-05-21",600],
];

function makeSession([date, startTime, endTime, parking, other, earned], id) {
  const [sh,sm] = startTime.split(":").map(Number);
  const [eh,em] = endTime.split(":").map(Number);
  const hours = ((eh*60+em)-(sh*60+sm))/60;
  const rate = rateForDate(date);
  return { id, date, startTime, endTime,
    hours: +hours.toFixed(4), km:0, gas:0, parking: parking||0, other: other||0,
    earned: earned, rate };
}

function buildSeed() {
  const sessions = SEED_SESSIONS.map((row,i) => makeSession(row,"s"+i));
  const airports = SEED_AIRPORTS.map(([date,ap,pk,earned],i) => ({
    id:"a"+i, date, airport:ap, parking:pk||0, gas:0, earned
  }));
  const payments = SEED_PAYMENTS.map(([date,amt],i) => ({ id:"p"+i, date, amount:amt }));
  return { sessions, airports, payments };
}

// ── cute dog SVG ──────────────────────────────────────────────────────────────
const DogSVG = ({size=32, style={}}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style} xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="40" rx="16" ry="13" fill="#f9c8d4"/>
    <ellipse cx="32" cy="26" rx="13" ry="12" fill="#f9c8d4"/>
    <ellipse cx="21" cy="18" rx="6" ry="9" fill="#f4a7bb" transform="rotate(-15 21 18)"/>
    <ellipse cx="43" cy="18" rx="6" ry="9" fill="#f4a7bb" transform="rotate(15 43 18)"/>
    <circle cx="27" cy="25" r="2.5" fill="#3a2a2a"/>
    <circle cx="37" cy="25" r="2.5" fill="#3a2a2a"/>
    <circle cx="27.8" cy="24.2" r=".9" fill="white"/>
    <circle cx="37.8" cy="24.2" r=".9" fill="white"/>
    <ellipse cx="32" cy="30" rx="4" ry="3" fill="#e88ba0"/>
    <path d="M30 31 Q32 33.5 34 31" stroke="#c9607a" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <ellipse cx="32" cy="46" rx="7" ry="5" fill="#f4a7bb"/>
    <ellipse cx="20" cy="50" rx="5" ry="3.5" fill="#f9c8d4"/>
    <ellipse cx="44" cy="50" rx="5" ry="3.5" fill="#f9c8d4"/>
    <path d="M38 47 Q45 43 50 46" stroke="#f4a7bb" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
  </svg>
);

const PAWS = ["🐾","🐾","🐾"];

// ── main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const seed = buildSeed();
  const [sessions, setSessions] = useState(seed.sessions);
  const [airports, setAirports] = useState(seed.airports);
  const [payments, setPayments] = useState(seed.payments);
  const [tab, setTab] = useState("dashboard");
  const [showHistory, setShowHistory] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editingAirport, setEditingAirport] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [quickLog, setQuickLog] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("yarden_feedback") || "[]"); } catch { return []; }
  });
  const [clockedIn, setClockedIn] = useState(() => {
    try { return JSON.parse(localStorage.getItem("yarden_clockin") || "null"); } catch { return null; }
  });

  const [newSession, setNewSession] = useState({ date: today(), startTime: "16:30", endTime: "20:00", parking: 0, other: 0 });
  const [newAirport, setNewAirport] = useState({ date: today(), airport: "Brussels", parking: 0 });
  const [newPayment, setNewPayment] = useState({ date: today(), amount: "" });

  // totalEarned = pure hours × rate + airport flat fees
  // totalExpenses = all reimbursable costs employer owes back (gas + parking + other)
  // balance = totalEarned + totalExpenses - totalPaid
  const totalEarned = sessions.reduce((s,x) => s+x.earned, 0) + airports.reduce((s,x) => s+x.earned, 0);
  const totalExpenses = sessions.reduce((s,x) => s+x.gas+x.parking+x.other, 0) + airports.reduce((s,x) => s+x.gas+x.parking, 0);
  const totalPaid = payments.reduce((s,x) => s+x.amount, 0);
  const balance = totalEarned + totalExpenses - totalPaid;

  function saveFeedback(notes) {
    setFeedbackNotes(notes);
    localStorage.setItem("yarden_feedback", JSON.stringify(notes));
  }

  function clockIn() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,"0");
    const mm = String(now.getMinutes()).padStart(2,"0");
    const d = now.toISOString().split("T")[0];
    const ci = { date: d, startTime: `${hh}:${mm}` };
    setClockedIn(ci);
    localStorage.setItem("yarden_clockin", JSON.stringify(ci));
    setNewSession(p => ({...p, date: d, startTime: `${hh}:${mm}`, endTime: ""}));
    setTab("hours");
  }

  function clockOut() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,"0");
    const mm = String(now.getMinutes()).padStart(2,"0");
    setNewSession(p => ({...p, endTime: `${hh}:${mm}`}));
    setClockedIn(null);
    localStorage.removeItem("yarden_clockin");
    setTab("hours");
  }

  function calcEndTime(startTime, hoursWorked) {
    const [h,m] = startTime.split(":").map(Number);
    const totalMin = h*60 + m + Math.round(parseFloat(hoursWorked||0)*60);
    return `${String(Math.floor(totalMin/60)%24).padStart(2,"0")}:${String(totalMin%60).padStart(2,"0")}`;
  }

  function addSession() {
    const [sh,sm] = newSession.startTime.split(":").map(Number);
    const [eh,em] = newSession.endTime.split(":").map(Number);
    const hrs = ((eh*60+em) - (sh*60+sm)) / 60;
    if (hrs <= 0) return;
    const rate = rateForDate(newSession.date);
    const s = { id:"s"+Date.now(), date:newSession.date, startTime:newSession.startTime,
      endTime:newSession.endTime, hours:+hrs.toFixed(4), km:0, gas:0,
      parking:+newSession.parking, other:+newSession.other,
      earned:+(hrs*rate).toFixed(4), rate };
    setSessions(prev => [...prev, s].sort((a,b) => a.date.localeCompare(b.date)));
    setNewSession(p => ({...p, date:today(), parking:0, other:0}));
  }

  function saveEdit(updated) {
    setSessions(prev => prev.map(x => x.id===updated.id ? updated : x).sort((a,b)=>a.date.localeCompare(b.date)));
    setEditingSession(null);
  }

  function saveAirportEdit(updated) {
    setAirports(prev => prev.map(x => x.id===updated.id ? updated : x).sort((a,b)=>a.date.localeCompare(b.date)));
    setEditingAirport(null);
  }

  function savePaymentEdit(updated) {
    setPayments(prev => prev.map(x => x.id===updated.id ? updated : x).sort((a,b)=>a.date.localeCompare(b.date)));
    setEditingPayment(null);
  }

  function addAirport() {
    const info = AIRPORTS[newAirport.airport];
    const a = { id:"a"+Date.now(), date:newAirport.date, airport:newAirport.airport,
      parking:+newAirport.parking, gas:+(info.km*FUEL_PER_KM).toFixed(4), earned:info.earned };
    setAirports(prev => [...prev, a].sort((a,b)=>a.date.localeCompare(b.date)));
    setNewAirport(p => ({...p, date:today(), parking:0}));
  }

  function addPayment() {
    if (!newPayment.amount) return;
    const p = { id:"p"+Date.now(), date:newPayment.date, amount:+newPayment.amount };
    setPayments(prev => [...prev, p].sort((a,b)=>a.date.localeCompare(b.date)));
    setNewPayment(p => ({...p, date:today(), amount:""}));
  }

  function deleteItem(type, id) {
    if (type==="session") setSessions(p=>p.filter(x=>x.id!==id));
    if (type==="airport") setAirports(p=>p.filter(x=>x.id!==id));
    if (type==="payment") setPayments(p=>p.filter(x=>x.id!==id));
  }

  const recentSessions = [...sessions].reverse().slice(0,10);
  const recentAirports = [...airports].reverse().slice(0,10);
  const allPayments = [...payments].reverse();

  const tabs = [["dashboard","🏠 Home"],["hours","⏰ Hours"],["airport","✈️ Airport"],["payment","💰 Payment"],["analytics","📊 Analytics"]];

  return (
    <div style={S.root}>
      {/* decorative dogs */}
      <DogSVG size={38} style={{position:"fixed",top:12,right:12,opacity:0.18,transform:"rotate(10deg)",pointerEvents:"none"}}/>
      <DogSVG size={28} style={{position:"fixed",bottom:60,left:8,opacity:0.13,transform:"rotate(-15deg) scaleX(-1)",pointerEvents:"none"}}/>
      <DogSVG size={22} style={{position:"fixed",top:"45%",right:5,opacity:0.1,transform:"rotate(5deg)",pointerEvents:"none"}}/>

      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <img src="/dog.png" alt="dog" style={{width:48,height:48,borderRadius:"50%",objectFit:"cover",objectPosition:"center top",border:"2px solid #fce7f0",boxShadow:"0 2px 8px #f4a7bb33"}}/>
            <div>
              <div style={S.logo}>Yarden Babysitting</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button style={S.feedbackBtn} onClick={()=>setShowFeedback(true)} title="Feedback & ideas">💬</button>
            <div style={S.balancePill}>
              <span style={S.balanceLabel}>Still owed</span>
              <span style={{...S.balanceAmount, color: balance > 50 ? "#e8527a" : "#7ec8a0"}}>{fmtEuro(Math.abs(balance))}</span>
            </div>
          </div>
        </div>
      </header>

      {/* clock-in banner */}
      {clockedIn && <ClockBanner clockedIn={clockedIn} clockOut={clockOut} onReset={()=>{setClockedIn(null);localStorage.removeItem("yarden_clockin");}} />}

      <nav style={S.nav}>
        {tabs.map(([id,label]) => (
          <button key={id} style={{...S.navBtn,...(tab===id?S.navActive:{})}} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </nav>

      <main style={S.main}>
        {tab==="dashboard" && <Dashboard sessions={sessions} airports={airports} payments={payments} totalEarned={totalEarned} totalExpenses={totalExpenses} totalPaid={totalPaid} balance={balance} recentSessions={recentSessions} recentAirports={recentAirports} allPayments={allPayments} showHistory={showHistory} setShowHistory={setShowHistory} deleteItem={deleteItem} setEditingSession={setEditingSession} setEditingAirport={setEditingAirport} setEditingPayment={setEditingPayment} />}
        {tab==="hours" && <LogHours newSession={newSession} setNewSession={setNewSession} addSession={addSession} recentSessions={recentSessions} allSessions={sessions} deleteItem={deleteItem} setEditingSession={setEditingSession} clockedIn={clockedIn} clockIn={clockIn} clockOut={clockOut} />}
        {tab==="airport" && <LogAirport newAirport={newAirport} setNewAirport={setNewAirport} addAirport={addAirport} recentAirports={recentAirports} deleteItem={deleteItem} setEditingAirport={setEditingAirport} />}
        {tab==="payment" && <LogPayment newPayment={newPayment} setNewPayment={setNewPayment} addPayment={addPayment} allPayments={allPayments} showHistory={showHistory} setShowHistory={setShowHistory} deleteItem={deleteItem} setEditingPayment={setEditingPayment} />}
        {tab==="analytics" && <Analytics sessions={sessions} airports={airports} payments={payments} />}
      </main>

      {/* floating quick-log button */}
      <QuickLogFAB
        quickLog={quickLog} setQuickLog={setQuickLog}
        newSession={newSession} setNewSession={setNewSession} addSession={()=>{addSession();setQuickLog(null);}}
        newAirport={newAirport} setNewAirport={setNewAirport} addAirport={()=>{addAirport();setQuickLog(null);}}
        clockedIn={clockedIn} clockIn={clockIn} clockOut={clockOut}
        setClockedIn={setClockedIn}
      />

      {editingSession && <EditModal session={editingSession} onSave={saveEdit} onClose={()=>setEditingSession(null)} />}
      {editingAirport && <EditAirportModal airport={editingAirport} onSave={saveAirportEdit} onClose={()=>setEditingAirport(null)} />}
      {editingPayment && <EditPaymentModal payment={editingPayment} onSave={savePaymentEdit} onClose={()=>setEditingPayment(null)} />}
      {showFeedback && <FeedbackModal notes={feedbackNotes} onSave={saveFeedback} onClose={()=>setShowFeedback(false)} />}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({sessions,airports,payments,totalEarned,totalExpenses,totalPaid,balance,recentSessions,recentAirports,allPayments,showHistory,setShowHistory,deleteItem,setEditingSession,setEditingAirport,setEditingPayment}) {
  return (
    <div>
      <div style={S.cardRow}>
        <StatCard label="Total Earned" value={fmtEuro(totalEarned)} accent={C.green} icon="🌿"/>
        <StatCard label="Total Expenses" value={fmtEuro(totalExpenses)} accent={C.blue} icon="🧾"/>
        <StatCard label="Total Paid" value={fmtEuro(totalPaid)} accent="#a78bfa" icon="💙"/>
        <StatCard label="Still Owed" value={fmtEuro(balance)} accent={balance>50?C.pink:C.green} icon={balance>50?"🐾":"✨"}/>
      </div>
      <Sect title="🐕 Recent Sessions">
        <SessionList sessions={recentSessions} deleteItem={deleteItem} setEditingSession={setEditingSession}/>
      </Sect>
      <Sect title="✈️ Recent Airport Trips">
        <AirportList airports={recentAirports} deleteItem={deleteItem} setEditingAirport={setEditingAirport}/>
      </Sect>
      <Sect title="💰 Payments">
        <button style={S.toggleBtn} onClick={()=>setShowHistory(!showHistory)}>{showHistory?"▲ Hide":"▼ Show"} payment history</button>
        {showHistory && <PaymentList payments={allPayments} deleteItem={deleteItem} setEditingPayment={setEditingPayment}/>}
      </Sect>
    </div>
  );
}

// ── Log Hours ─────────────────────────────────────────────────────────────────
function LogHours({newSession,setNewSession,addSession,recentSessions,allSessions,deleteItem,setEditingSession,clockedIn,clockIn,clockOut}) {
  const [showAll, setShowAll] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const allReversed = [...allSessions].reverse();
  const months = [...new Set(allSessions.map(s=>s.date.slice(0,7)))].sort().reverse();
  const filtered = filterMonth ? allReversed.filter(s=>s.date.startsWith(filterMonth)) : allReversed;
  const displayed = showAll ? filtered : recentSessions;
  function calcHrs(start, end) {
    if (!start || !end) return 0;
    const [sh,sm] = start.split(":").map(Number);
    const [eh,em] = end.split(":").map(Number);
    return Math.max(0,((eh*60+em)-(sh*60+sm))/60);
  }
  const hrs = calcHrs(newSession.startTime, newSession.endTime);
  const rate = rateForDate(newSession.date);
  return (
    <div>
      <div style={S.card}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <img src="/dog.png" alt="dog" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",objectPosition:"center top",border:"1.5px solid #fce7f0"}}/>
          <h2 style={S.cardTitle}>Log Working Hours</h2>
        </div>
        {!clockedIn ? (
          <button style={{...S.primaryBtn,marginBottom:16,background:"linear-gradient(135deg,#f4a7bb,#f9c8d4)",fontSize:14}} onClick={clockIn}>
            ⏱ Clock in now — I'm starting work
          </button>
        ) : (
          <div style={{marginBottom:16,display:"flex",flexDirection:"column",gap:8}}>
            <div style={{background:"#fff0f5",borderRadius:12,padding:"10px 14px",fontSize:13,color:"#b5476a",border:"1px solid #fce7f0"}}>
              ✅ Clocked in at <strong>{clockedIn.startTime}</strong> — fill in end time when done
            </div>
            <button style={{...S.primaryBtn,background:"linear-gradient(135deg,#5db887,#a8d4f5)",fontSize:14}} onClick={clockOut}>
              ⏹ Clock out now — fill end time automatically
            </button>
          </div>
        )}
        <div style={S.formGrid}>
          <Field label="📅 Date">
            <input style={S.input} type="date" value={newSession.date} onChange={e=>setNewSession(p=>({...p,date:e.target.value}))}/>
          </Field>
          <Field label="🕐 Start time">
            <input style={S.input} type="time" value={newSession.startTime} onChange={e=>setNewSession(p=>({...p,startTime:e.target.value}))}/>
          </Field>
          <Field label="🕔 End time">
            <input style={S.input} type="time" value={newSession.endTime} onChange={e=>setNewSession(p=>({...p,endTime:e.target.value}))}/>
          </Field>
          <Field label="⏱ Hours worked">
            <div style={{...S.input,background:"#fce7f0",color:"#b5476a",fontWeight:700}}>
              {hrs>0?`${hrs.toFixed(2)} hrs`:"—"}
            </div>
          </Field>
          <Field label="🅿️ Parking (€)">
            <input style={S.input} type="number" min="0" step="0.01" value={newSession.parking} onChange={e=>setNewSession(p=>({...p,parking:e.target.value}))}/>
          </Field>
          <Field label="📦 Other expenses (€)">
            <input style={S.input} type="number" min="0" step="0.01" value={newSession.other} onChange={e=>setNewSession(p=>({...p,other:e.target.value}))}/>
          </Field>
        </div>
        <div style={S.preview}>
          <span>{hrs.toFixed(2)} hrs × €{rate}/hr</span>
          <span style={S.previewAmt}>{fmtEuro(hrs*rate)}</span>
        </div>
        <button style={{...S.primaryBtn,opacity:hrs>0?1:0.5}} onClick={addSession} disabled={hrs<=0}>Add Session 🐾</button>
      </div>
      <Sect title={showAll?`All Sessions (${filtered.length}) 🐾`:"Recent Sessions"}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
          <button style={{...S.toggleBtn,...(showAll?{background:"#fce7f0",color:"#b5476a",borderColor:"#f4a7bb"}:{})}}
            onClick={()=>{setShowAll(p=>!p);setFilterMonth("");}}>
            {showAll?"▲ Show recent only":`▼ Show all ${allSessions.length} sessions`}
          </button>
          {showAll && (
            <select style={{...S.input,width:"auto",fontSize:12,padding:"6px 10px"}}
              value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
              <option value="">All months</option>
              {months.map(m=>{const[y,mo]=m.split("-");const label=new Date(+y,+mo-1,1).toLocaleDateString("en",{month:"long",year:"numeric"});return<option key={m} value={m}>{label}</option>;})}
            </select>
          )}
          {showAll && filterMonth && (
            <span style={{fontSize:12,color:"#c9a0b0"}}>
              {fmtEuro(filtered.reduce((s,x)=>s+x.earned+(x.other||0),0))} earned · {filtered.reduce((s,x)=>s+x.hours,0).toFixed(1)}h worked
            </span>
          )}
        </div>
        <SessionList sessions={displayed} deleteItem={deleteItem} setEditingSession={setEditingSession}/>
      </Sect>
    </div>
  );
}

// ── Log Airport ───────────────────────────────────────────────────────────────
function LogAirport({newAirport,setNewAirport,addAirport,recentAirports,deleteItem,setEditingAirport}) {
  const info = AIRPORTS[newAirport.airport];
  return (
    <div>
      <div style={S.card}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <img src="/dog.png" alt="dog" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",objectPosition:"center top",border:"1.5px solid #fce7f0"}}/>
          <h2 style={S.cardTitle}>Log Airport Trip ✈️</h2>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date">
            <input style={S.input} type="date" value={newAirport.date} onChange={e=>setNewAirport(p=>({...p,date:e.target.value}))}/>
          </Field>
          <Field label="🛫 Airport">
            <select style={S.input} value={newAirport.airport} onChange={e=>setNewAirport(p=>({...p,airport:e.target.value}))}>
              {Object.keys(AIRPORTS).map(a=><option key={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="🅿️ Parking ticket (€)">
            <input style={S.input} type="number" min="0" step="0.01" value={newAirport.parking} onChange={e=>setNewAirport(p=>({...p,parking:e.target.value}))}/>
          </Field>
        </div>
        <div style={S.preview}>
          <span>{newAirport.airport} Airport trip</span>
          <span style={S.previewAmt}>{fmtEuro(info.earned)}</span>
        </div>
        <button style={S.primaryBtn} onClick={addAirport}>Add Trip 🐾</button>
      </div>
      <Sect title="Recent Airport Trips">
        <AirportList airports={recentAirports} deleteItem={deleteItem} setEditingAirport={setEditingAirport}/>
      </Sect>
    </div>
  );
}

// ── Log Payment ───────────────────────────────────────────────────────────────
function LogPayment({newPayment,setNewPayment,addPayment,allPayments,showHistory,setShowHistory,deleteItem,setEditingPayment}) {
  return (
    <div>
      <div style={S.card}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <img src="/dog.png" alt="dog" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",objectPosition:"center top",border:"1.5px solid #fce7f0"}}/>
          <h2 style={S.cardTitle}>Register Payment 💰</h2>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date">
            <input style={S.input} type="date" value={newPayment.date} onChange={e=>setNewPayment(p=>({...p,date:e.target.value}))}/>
          </Field>
          <Field label="💶 Amount (€)">
            <input style={S.input} type="number" min="0" step="0.01" value={newPayment.amount} placeholder="0.00" onChange={e=>setNewPayment(p=>({...p,amount:e.target.value}))}/>
          </Field>
        </div>
        <button style={S.primaryBtn} onClick={addPayment}>Add Payment 🐾</button>
      </div>
      <Sect title="Payment History">
        <button style={S.toggleBtn} onClick={()=>setShowHistory(!showHistory)}>{showHistory?"▲ Hide":"▼ Show"} payment history</button>
        {showHistory && <PaymentList payments={allPayments} deleteItem={deleteItem} setEditingPayment={setEditingPayment}/>}
      </Sect>
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function Analytics({sessions, airports, payments}) {
  const [monthView, setMonthView] = useState("earned"); // "earned" | "hours"
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const RATE_CHANGE = "2025-09";

  function monthKey(d) { return d.slice(0,7); }
  function netForSession(s) { return s.earned + s.gas + s.parking + s.other; }
  function netForAirport(a) { return a.earned + a.gas + a.parking; }

  // group all earnings and hours by month
  const monthEarned = {}, monthHours = {};
  sessions.forEach(s => {
    const k = monthKey(s.date);
    monthEarned[k] = (monthEarned[k]||0) + netForSession(s);
    monthHours[k]  = (monthHours[k]||0)  + s.hours;
  });
  airports.forEach(a => {
    const k = monthKey(a.date);
    monthEarned[k] = (monthEarned[k]||0) + netForAirport(a);
  });

  const allMonthKeys = Object.keys(monthEarned).sort();
  // "complete" months = all except the current one
  const completeKeys = allMonthKeys.filter(k => k < thisMonth);

  function longMonth(k) {
    const [y,m] = k.split("-");
    return new Date(+y,+m-1,1).toLocaleDateString("en",{month:"long",year:"numeric"});
  }
  function shortMonthYear(k) {
    const [y,m] = k.split("-");
    return new Date(+y,+m-1,1).toLocaleDateString("en",{month:"short",year:"2-digit"});
  }

  // stats only on complete months
  const bestKey  = completeKeys.length ? completeKeys.reduce((a,b)=>monthEarned[a]>monthEarned[b]?a:b) : "";
  const worstKey = completeKeys.length ? completeKeys.reduce((a,b)=>monthEarned[a]<monthEarned[b]?a:b) : "";
  const mostHrsKey  = completeKeys.length ? completeKeys.reduce((a,b)=>(monthHours[a]||0)>(monthHours[b]||0)?a:b) : "";
  const leastHrsKey = completeKeys.length ? completeKeys.reduce((a,b)=>(monthHours[a]||0)<(monthHours[b]||0)?a:b) : "";

  // averages on complete months only
  function avgComplete(n) {
    const last = completeKeys.slice(-n);
    if (!last.length) return 0;
    return last.reduce((s,k)=>s+(monthEarned[k]||0),0)/last.length;
  }
  const earnedThisMonth = monthEarned[thisMonth]||0;
  const hoursThisMonth  = monthHours[thisMonth]||0;
  const avg3  = avgComplete(3);
  const avg6  = avgComplete(6);
  const avg12 = avgComplete(12);
  const avgAll = completeKeys.length ? completeKeys.reduce((s,k)=>s+(monthEarned[k]||0),0)/completeKeys.length : 0;

  // avg since pay increase (Sept 2025 onwards, complete months only)
  const sinceRaiseKeys = completeKeys.filter(k => k >= RATE_CHANGE);
  const avgSinceRaise = sinceRaiseKeys.length ? sinceRaiseKeys.reduce((s,k)=>s+(monthEarned[k]||0),0)/sinceRaiseKeys.length : 0;

  const totalHours = sessions.reduce((s,x)=>s+x.hours,0);
  const totalAirportTrips = airports.length;

  // payment gap
  const sortedPay = [...payments].sort((a,b)=>a.date.localeCompare(b.date));
  let avgPayGap = 0;
  if (sortedPay.length > 1) {
    const gaps = sortedPay.slice(1).map((p,i)=>(new Date(p.date)-new Date(sortedPay[i].date))/(1000*60*60*24));
    avgPayGap = gaps.reduce((a,b)=>a+b,0)/gaps.length;
  }

  // busiest weekday
  const weekdayCounts = [0,0,0,0,0,0,0];
  const weekdayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  sessions.forEach(s => { weekdayCounts[new Date(s.date).getDay()]++; });
  const busyDay = weekdayNames[weekdayCounts.indexOf(Math.max(...weekdayCounts))];

  // bar chart: last 6 complete months
  const last6 = completeKeys.slice(-6);
  const chartData = monthView === "earned" ? monthEarned : monthHours;
  const maxVal = Math.max(...last6.map(k=>chartData[k]||0), 1);

  // monthly overview table: all months desc
  const allDesc = [...allMonthKeys].reverse();

  return (
    <div>
      <div style={{...S.card, background:"linear-gradient(135deg,#fff0f5 0%,#f0f8ff 100%)", border:"1.5px solid #f9c8d4"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
          <img src="/dog.png" alt="dog" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",objectPosition:"center top",border:"1.5px solid #fce7f0"}}/>
          <h2 style={{...S.cardTitle,color:"#b5476a"}}>Yarden's Earnings Stats 📊</h2>
        </div>
        <p style={{color:"#c97a94",fontSize:13,margin:"0 0 20px"}}>All the numbers about Yarden's hard work! 🐾</p>

        {/* top stat cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <AnalCard label="This month (so far)" value={fmtEuro(earnedThisMonth)} accent={C.pink} note={`${hoursThisMonth.toFixed(1)}h worked`}/>
          <AnalCard label="Avg last 3 months" value={fmtEuro(avg3)} accent={C.blue} note="complete months only"/>
          <AnalCard label="Avg last 6 months" value={fmtEuro(avg6)} accent={C.green} note="complete months only"/>
          <AnalCard label="Avg last 12 months" value={fmtEuro(avg12)} accent={C.pink} note="complete months only"/>
          <AnalCard label="All-time avg (complete months)" value={fmtEuro(avgAll)} accent={C.blue} note="per month"/>
          <AnalCard label="Avg since €20/hr raise" value={fmtEuro(avgSinceRaise)} accent={C.green} note={`Sep '25 → now (${sinceRaiseKeys.length} months)`}/>
          <AnalCard label="Total hours worked" value={totalHours.toFixed(1)+"h"} accent={C.pink} note={`across ${sessions.length} sessions`}/>
          <AnalCard label="Airport trips" value={totalAirportTrips} accent={C.blue} note="total trips"/>
        </div>

        {/* bar chart with toggle */}
        <div style={{background:"white",borderRadius:14,padding:"16px 16px 12px",marginBottom:16,border:"1px solid #fce7f0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:12,color:"#c97a94",fontWeight:700,letterSpacing:.5}}>LAST 6 COMPLETE MONTHS</span>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>setMonthView("earned")} style={{...toggleStyle, background: monthView==="earned"?"#f9c8d4":"transparent", color: monthView==="earned"?"#b5476a":"#c9a0b0"}}>€ Earned</button>
              <button onClick={()=>setMonthView("hours")} style={{...toggleStyle, background: monthView==="hours"?"#c4dff5":"transparent", color: monthView==="hours"?"#2a5c8a":"#c9a0b0"}}>⏱ Hours</button>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100}}>
            {last6.map(k=>{
              const val = chartData[k]||0;
              const barH = Math.max(4,(val/maxVal)*80);
              const label = monthView==="earned" ? fmtEuro(val) : val.toFixed(1)+"h";
              return (
                <div key={k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <span style={{fontSize:8,color:"#b5476a",fontWeight:700,textAlign:"center",lineHeight:1.2}}>{label}</span>
                  <div style={{width:"100%",background:monthView==="earned"?`linear-gradient(180deg,${C.pink} 0%,#f4a7bb 100%)`:`linear-gradient(180deg,${C.blue} 0%,#a8d4f5 100%)`,borderRadius:"6px 6px 0 0",height:barH,transition:"height .4s"}}/>
                  <span style={{fontSize:8,color:"#c97a94",fontWeight:600,textAlign:"center"}}>{shortMonthYear(k)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* fun facts — complete months only */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
          <FunFact icon="🏆" label="Best month" value={bestKey ? `${longMonth(bestKey)}` : "—"} sub={bestKey ? fmtEuro(monthEarned[bestKey]) : ""}/>
          <FunFact icon="📉" label="Quietest month" value={worstKey ? `${longMonth(worstKey)}` : "—"} sub={worstKey ? fmtEuro(monthEarned[worstKey]) : ""}/>
          <FunFact icon="⏰" label="Most hours" value={mostHrsKey ? `${longMonth(mostHrsKey)}` : "—"} sub={mostHrsKey ? (monthHours[mostHrsKey]||0).toFixed(1)+"h" : ""}/>
          <FunFact icon="😴" label="Fewest hours" value={leastHrsKey ? `${longMonth(leastHrsKey)}` : "—"} sub={leastHrsKey ? (monthHours[leastHrsKey]||0).toFixed(1)+"h" : ""}/>
          <FunFact icon="📅" label="Busiest weekday" value={busyDay} sub="most sessions"/>
          <FunFact icon="💸" label="Avg pay gap" value={avgPayGap>0?`${avgPayGap.toFixed(0)} days`:"—"} sub="between payments"/>
        </div>

        {/* monthly overview table */}
        <div style={{background:"white",borderRadius:14,padding:"16px",border:"1px solid #fce7f0"}}>
          <div style={{fontSize:12,color:"#c97a94",fontWeight:700,marginBottom:12,letterSpacing:.5}}>📋 MONTHLY OVERVIEW</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0,fontSize:11,color:"#c9a0b0",fontWeight:700,paddingBottom:6,borderBottom:"1px solid #fce7f0",marginBottom:4}}>
            <span>Month</span><span style={{textAlign:"right"}}>Hours</span><span style={{textAlign:"right"}}>Earned</span>
          </div>
          <div style={{maxHeight:320,overflowY:"auto"}}>
            {allDesc.map(k => {
              const isThis = k === thisMonth;
              return (
                <div key={k} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0,padding:"6px 0",borderBottom:"1px solid #fdf5f8",background:isThis?"#fff7fa":"transparent",borderRadius:isThis?6:0}}>
                  <span style={{fontSize:12,fontWeight:isThis?700:500,color:isThis?"#b5476a":"#3a2a35"}}>{longMonth(k)}{isThis?" ★":""}</span>
                  <span style={{fontSize:12,textAlign:"right",color:"#7a6a70"}}>{(monthHours[k]||0).toFixed(1)}h</span>
                  <span style={{fontSize:12,textAlign:"right",fontWeight:600,color:C.green}}>{fmtEuro(monthEarned[k]||0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const toggleStyle = {border:"1px solid #fce7f0",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"};

function FunFact({icon,label,value,sub}) {
  return (
    <div style={{background:"#fff7fa",borderRadius:12,padding:"10px 12px",border:"1px solid #fce7f0",textAlign:"center"}}>
      <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:10,color:"#c97a94",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
      <div style={{fontSize:12,fontWeight:800,color:"#b5476a",marginTop:2,lineHeight:1.3}}>{value}</div>
      {sub && <div style={{fontSize:11,color:C.green,fontWeight:700,marginTop:2}}>{sub}</div>}
    </div>
  );
}

function AnalCard({label,value,accent,note}) {
  return (
    <div style={{background:"white",borderRadius:12,padding:"14px 16px",border:`1.5px solid ${accent}33`,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent}}/>
      <div style={{fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color:accent}}>{value}</div>
      <div style={{fontSize:11,color:"#bbb",marginTop:2}}>{note}</div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({session, onSave, onClose}) {
  const [form, setForm] = useState({...session});

  function calcHrs(start, end) {
    const [sh,sm] = start.split(":").map(Number);
    const [eh,em] = end.split(":").map(Number);
    const mins = (eh*60+em) - (sh*60+sm);
    return mins > 0 ? mins/60 : 0;
  }
  const hrs = calcHrs(form.startTime, form.endTime);
  const rate = rateForDate(form.date);

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,color:"#b5476a",fontSize:17,fontWeight:800}}>✏️ Edit Session</h3>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date">
            <input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
          </Field>
          <Field label="🕐 Start time">
            <input style={S.input} type="time" value={form.startTime} onChange={e=>setForm(p=>({...p,startTime:e.target.value}))}/>
          </Field>
          <Field label="🕔 End time">
            <input style={S.input} type="time" value={form.endTime} onChange={e=>setForm(p=>({...p,endTime:e.target.value}))}/>
          </Field>
          <Field label="⏱ Hours worked">
            <div style={{...S.input,background:"#fce7f0",color:"#b5476a",fontWeight:700}}>
              {hrs > 0 ? `${hrs.toFixed(2)} hrs` : "—"}
            </div>
          </Field>
          <Field label="🅿️ Parking (€)">
            <input style={S.input} type="number" min="0" step="0.01" value={form.parking} onChange={e=>setForm(p=>({...p,parking:+e.target.value}))}/>
          </Field>
          <Field label="📦 Other (€)">
            <input style={S.input} type="number" min="0" step="0.01" value={form.other} onChange={e=>setForm(p=>({...p,other:+e.target.value}))}/>
          </Field>
        </div>
        <div style={S.preview}>
          <span>{hrs.toFixed(2)} hrs × €{rate}/hr</span>
          <span style={S.previewAmt}>{fmtEuro(hrs*rate)}</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button>
          <button style={{...S.primaryBtn,flex:2}} onClick={()=>onSave({...form, hours:hrs, earned:+(hrs*rate).toFixed(4), rate})}>Save Changes 🐾</button>
        </div>
      </div>
    </div>
  );
}

// ── reusable display ──────────────────────────────────────────────────────────
function StatCard({label,value,accent,icon}) {
  return (
    <div style={{...S.statCard,borderTop:`3px solid ${accent}`}}>
      <div style={{fontSize:20,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:11,color:"#c9a0b0",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
      <div style={{fontSize:21,fontWeight:800,color:accent}}>{value}</div>
    </div>
  );
}

function Sect({title,children}) {
  return <div style={{marginBottom:22}}><h3 style={S.sectTitle}>{title}</h3>{children}</div>;
}

function Field({label,children}) {
  return <label style={S.label}><span style={{marginBottom:5,display:"block"}}>{label}</span>{children}</label>;
}

function SessionList({sessions,deleteItem,setEditingSession}) {
  if (!sessions.length) return <p style={S.empty}>No sessions yet — let's start working! 🐾</p>;
  return (
    <div style={S.list}>
      {sessions.map(s=>{
        const totalExpenses = (s.parking||0) + (s.other||0) + (s.gas||0);
        const expParts = [];
        if (s.parking>0) expParts.push(`🅿️ €${s.parking.toFixed(2)}`);
        if (s.other>0)   expParts.push(`📦 €${s.other.toFixed(2)}`);
        if (s.gas>0)     expParts.push(`⛽ €${s.gas.toFixed(2)}`);
        return (
          <div key={s.id} style={S.listItem}>
            <div style={S.listLeft}>
              <span style={S.listDate}>{fmtDate(new Date(s.date))}</span>
              <span style={S.listSub}>{s.startTime} – {s.endTime} · {s.hours.toFixed(2)}h · €{s.rate}/hr</span>
              {expParts.length > 0 && (
                <span style={{fontSize:11,color:"#c9a0b0",marginTop:1,letterSpacing:0.1}}>{expParts.join("  ")}</span>
              )}
            </div>
            <div style={S.listRight}>
              <span style={{...S.listAmt,color:C.green}}>{fmtEuro(s.earned)}</span>
              <button style={S.editBtn} onClick={()=>setEditingSession(s)} title="Edit">✏️</button>
              <button style={S.deleteBtn} onClick={()=>deleteItem("session",s.id)} title="Delete">✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AirportList({airports,deleteItem,setEditingAirport}) {
  if (!airports.length) return <p style={S.empty}>No trips yet 🛫</p>;
  return (
    <div style={S.list}>
      {airports.map(a=>(
        <div key={a.id} style={S.listItem}>
          <div style={S.listLeft}>
            <span style={S.listDate}>{fmtDate(new Date(a.date))}</span>
            <span style={S.listSub}>{a.airport} Airport{a.parking>0?` · 🅿️ €${a.parking.toFixed(2)}`:""}</span>
          </div>
          <div style={S.listRight}>
            <span style={{...S.listAmt,color:C.blue}}>{fmtEuro(a.earned)}</span>
            <button style={S.editBtn} onClick={()=>setEditingAirport(a)} title="Edit">✏️</button>
            <button style={S.deleteBtn} onClick={()=>deleteItem("airport",a.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Edit Airport Modal ────────────────────────────────────────────────────────
function EditAirportModal({airport, onSave, onClose}) {
  const [form, setForm] = useState({...airport});
  const info = AIRPORTS[form.airport] || AIRPORTS.Brussels;
  // earned is stored directly from the Excel; let it be editable too
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,color:"#b5476a",fontSize:17,fontWeight:800}}>✏️ Edit Airport Trip</h3>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date">
            <input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
          </Field>
          <Field label="🛫 Airport">
            <select style={S.input} value={form.airport} onChange={e=>setForm(p=>({...p,airport:e.target.value}))}>
              {Object.keys(AIRPORTS).map(a=><option key={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="🅿️ Parking ticket (€)">
            <input style={S.input} type="number" min="0" step="0.01" value={form.parking} onChange={e=>setForm(p=>({...p,parking:+e.target.value}))}/>
          </Field>
          <Field label="💶 Earned (€)">
            <input style={S.input} type="number" min="0" step="0.01" value={form.earned} onChange={e=>setForm(p=>({...p,earned:+e.target.value}))}/>
          </Field>
        </div>
        <div style={S.preview}>
          <span>{form.airport} Airport trip</span>
          <span style={S.previewAmt}>{fmtEuro(form.earned + (form.parking||0))}</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button>
          <button style={{...S.primaryBtn,flex:2}} onClick={()=>onSave(form)}>Save Changes 🐾</button>
        </div>
      </div>
    </div>
  );
}

function PaymentList({payments,deleteItem,setEditingPayment}) {
  if (!payments.length) return <p style={S.empty}>No payments yet 💸</p>;
  return (
    <div style={S.list}>
      {payments.map(p=>(
        <div key={p.id} style={S.listItem}>
          <div style={S.listLeft}><span style={S.listDate}>{fmtDate(new Date(p.date))}</span></div>
          <div style={S.listRight}>
            <span style={{...S.listAmt,color:C.blue}}>{fmtEuro(p.amount)}</span>
            <button style={S.editBtn} onClick={()=>setEditingPayment(p)} title="Edit">✏️</button>
            <button style={S.deleteBtn} onClick={()=>deleteItem("payment",p.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Clock Banner ──────────────────────────────────────────────────────────────
function ClockBanner({clockedIn, clockOut, onReset}) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    function tick() {
      const [h,m] = clockedIn.startTime.split(":").map(Number);
      const start = new Date();
      start.setHours(h, m, 0, 0);
      const diff = Math.max(0, Math.floor((new Date() - start) / 1000));
      const hh = String(Math.floor(diff/3600)).padStart(2,"0");
      const mm = String(Math.floor((diff%3600)/60)).padStart(2,"0");
      const ss = String(diff%60).padStart(2,"0");
      setElapsed(`${hh}:${mm}:${ss}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockedIn]);

  return (
    <div style={{background:"linear-gradient(135deg,#5db887,#a8d4f5)",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:24}}>⏱</span>
        <div>
          <div style={{color:"white",fontWeight:800,fontSize:15}}>Working since {clockedIn.startTime}</div>
          <div style={{color:"rgba(255,255,255,0.85)",fontSize:13,fontFamily:"monospace",fontWeight:600}}>{elapsed} elapsed</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button style={{background:"white",color:"#5db887",border:"none",borderRadius:10,padding:"8px 18px",fontWeight:800,fontSize:14,cursor:"pointer"}} onClick={clockOut}>
          ⏹ Clock out
        </button>
        <button style={{background:"rgba(255,255,255,0.25)",color:"white",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,padding:"8px 12px",fontWeight:600,fontSize:13,cursor:"pointer"}} onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}

// ── Quick Log FAB ─────────────────────────────────────────────────────────────
function QuickLogFAB({quickLog,setQuickLog,newSession,setNewSession,addSession,newAirport,setNewAirport,addAirport,clockedIn,clockIn,clockOut,setClockedIn}) {
  if (quickLog === "hours") {
    const [sh,sm] = newSession.startTime.split(":").map(Number);
    const [eh,em] = newSession.endTime.split(":").map(Number);
    const hrs = Math.max(0,((eh*60+em)-(sh*60+sm))/60);
    const rate = rateForDate(newSession.date);
    return (
      <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setQuickLog(null)}}>
        <div style={S.modal}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h3 style={{margin:0,color:"#b5476a",fontSize:17,fontWeight:800}}>⏰ Quick Log Hours</h3>
            <button style={S.closeBtn} onClick={()=>setQuickLog(null)}>✕</button>
          </div>
          <div style={S.formGrid}>
            <Field label="📅 Date">
              <input style={S.input} type="date" value={newSession.date} onChange={e=>setNewSession(p=>({...p,date:e.target.value}))}/>
            </Field>
            <Field label="🕐 Start time">
              <input style={S.input} type="time" value={newSession.startTime} onChange={e=>setNewSession(p=>({...p,startTime:e.target.value}))}/>
            </Field>
            <Field label="🕔 End time">
              <input style={S.input} type="time" value={newSession.endTime} onChange={e=>setNewSession(p=>({...p,endTime:e.target.value}))}/>
            </Field>
            <Field label="⏱ Hours worked">
              <div style={{...S.input,background:"#fce7f0",color:"#b5476a",fontWeight:700}}>{hrs>0?`${hrs.toFixed(2)} hrs`:"—"}</div>
            </Field>
            <Field label="🅿️ Parking (€)">
              <input style={S.input} type="number" min="0" step="0.01" value={newSession.parking} onChange={e=>setNewSession(p=>({...p,parking:e.target.value}))}/>
            </Field>
            <Field label="📦 Other (€)">
              <input style={S.input} type="number" min="0" step="0.01" value={newSession.other} onChange={e=>setNewSession(p=>({...p,other:e.target.value}))}/>
            </Field>
          </div>
          <div style={S.preview}>
            <span>{hrs.toFixed(2)} hrs × €{rate}/hr</span>
            <span style={S.previewAmt}>{fmtEuro(hrs*rate)}</span>
          </div>
          <button style={S.primaryBtn} onClick={addSession}>Add Session 🐾</button>
        </div>
      </div>
    );
  }
  if (quickLog === "airport") {
    const info = AIRPORTS[newAirport.airport] || AIRPORTS.Brussels;
    return (
      <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setQuickLog(null)}}>
        <div style={S.modal}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h3 style={{margin:0,color:"#b5476a",fontSize:17,fontWeight:800}}>✈️ Quick Log Airport Trip</h3>
            <button style={S.closeBtn} onClick={()=>setQuickLog(null)}>✕</button>
          </div>
          <div style={S.formGrid}>
            <Field label="📅 Date">
              <input style={S.input} type="date" value={newAirport.date} onChange={e=>setNewAirport(p=>({...p,date:e.target.value}))}/>
            </Field>
            <Field label="🛫 Airport">
              <select style={S.input} value={newAirport.airport} onChange={e=>setNewAirport(p=>({...p,airport:e.target.value}))}>
                {Object.keys(AIRPORTS).map(a=><option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="🅿️ Parking ticket (€)">
              <input style={S.input} type="number" min="0" step="0.01" value={newAirport.parking} onChange={e=>setNewAirport(p=>({...p,parking:e.target.value}))}/>
            </Field>
          </div>
          <div style={S.preview}>
            <span>{newAirport.airport} Airport trip</span>
            <span style={S.previewAmt}>{fmtEuro(info.earned)}</span>
          </div>
          <button style={S.primaryBtn} onClick={addAirport}>Add Trip 🐾</button>
        </div>
      </div>
    );
  }
  // default: show the floating buttons
  return (
    <div style={{position:"fixed",bottom:24,right:20,display:"flex",flexDirection:"column",gap:10,zIndex:500}}>
      {!clockedIn
        ? <button style={{...fabStyle("#5db887","white"),width:56,height:56,fontSize:22,boxShadow:"0 4px 20px rgba(93,184,135,0.5)"}} onClick={clockIn} title="Clock in">⏱</button>
        : <button style={{...fabStyle("#e8527a","white"),width:56,height:56,fontSize:22,boxShadow:"0 4px 20px rgba(232,82,122,0.5)"}} onClick={clockOut} title="Clock out">⏹</button>
      }
      <button style={fabStyle("#f4a7bb","#b5476a")} onClick={()=>setQuickLog("hours")} title="Log hours">⏰</button>
      <button style={fabStyle("#a8d4f5","#2a5c8a")} onClick={()=>setQuickLog("airport")} title="Log airport trip">✈️</button>
    </div>
  );
}
function fabStyle(bg,color) {
  return {width:48,height:48,borderRadius:"50%",border:"none",background:bg,color,fontSize:20,cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center",transition:"transform .15s"};
}

// ── Edit Payment Modal ────────────────────────────────────────────────────────
function EditPaymentModal({payment,onSave,onClose}) {
  const [form,setForm] = useState({...payment});
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,color:"#b5476a",fontSize:17,fontWeight:800}}>✏️ Edit Payment</h3>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date">
            <input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
          </Field>
          <Field label="💶 Amount (€)">
            <input style={S.input} type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm(p=>({...p,amount:+e.target.value}))}/>
          </Field>
        </div>
        <div style={{display:"flex",gap:10,marginTop:8}}>
          <button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button>
          <button style={{...S.primaryBtn,flex:2}} onClick={()=>onSave(form)}>Save Changes 🐾</button>
        </div>
      </div>
    </div>
  );
}

// ── Feedback Modal ────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  open:    {bg:"#fff7fa", color:"#b5476a", border:"#fce7f0", label:"Open"},
  done:    {bg:"#f0fff4", color:"#3a8a6a", border:"#c6f0d8", label:"✅ Done"},
  wontdo: {bg:"#f5f5f5", color:"#888",    border:"#ddd",    label:"🚫 Won't do"},
  cancel:  {bg:"#fff8f0", color:"#b87a30", border:"#ffe0b0", label:"❌ Cancelled"},
};

function FeedbackModal({notes, onSave, onClose}) {
  const [items, setItems] = useState(notes);
  const [newText, setNewText] = useState("");
  const [newAuthor, setNewAuthor] = useState("");

  function addNote() {
    if (!newText.trim()) return;
    setItems(prev => [...prev, {id: Date.now(), text: newText.trim(), author: newAuthor.trim()||"Anonymous", status:"open", date: new Date().toISOString().split("T")[0]}]);
    setNewText(""); setNewAuthor("");
  }

  function setStatus(id, status) {
    setItems(prev => prev.map(x => x.id===id ? {...x, status} : x));
  }

  function deleteNote(id) {
    setItems(prev => prev.filter(x => x.id!==id));
  }

  return (
    <div style={S.overlay}>
      <div style={{...S.modal, width:"min(560px,95vw)", maxHeight:"85vh", display:"flex", flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,color:"#b5476a",fontSize:17,fontWeight:800}}>💬 Feedback & Ideas</h3>
          <button style={S.closeBtn} onClick={()=>{onSave(items);onClose();}}>✕</button>
        </div>

        {/* add new */}
        <div style={{background:"#fdf5f8",borderRadius:14,padding:14,marginBottom:16,border:"1px solid #fce7f0"}}>
          <textarea
            style={{...S.input,minHeight:70,resize:"vertical",marginBottom:8}}
            placeholder="Describe your feedback or idea..."
            value={newText} onChange={e=>setNewText(e.target.value)}
          />
          <div style={{display:"flex",gap:8}}>
            <input style={{...S.input,flex:1}} placeholder="Your name (optional)" value={newAuthor} onChange={e=>setNewAuthor(e.target.value)}/>
            <button style={{...S.primaryBtn,width:"auto",padding:"9px 18px",fontSize:13}} onClick={addNote}>Add</button>
          </div>
        </div>

        {/* list */}
        <div style={{overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:8}}>
          {items.length===0 && <p style={S.empty}>No feedback yet — be the first! 🐾</p>}
          {[...items].reverse().map(item => {
            const st = STATUS_STYLES[item.status] || STATUS_STYLES.open;
            return (
              <div key={item.id} style={{background:st.bg,borderRadius:12,padding:"12px 14px",border:`1px solid ${st.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1}}>
                    <p style={{margin:"0 0 6px",fontSize:14,color:"#3a2a35",lineHeight:1.4}}>{item.text}</p>
                    <span style={{fontSize:11,color:"#c9a0b0"}}>{item.author} · {item.date}</span>
                  </div>
                  <button style={S.deleteBtn} onClick={()=>deleteNote(item.id)}>✕</button>
                </div>
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  {Object.entries(STATUS_STYLES).map(([key,val]) => (
                    <button key={key} onClick={()=>setStatus(item.id,key)} style={{padding:"3px 10px",borderRadius:8,border:`1px solid ${val.border}`,background:item.status===key?val.bg:"white",color:item.status===key?val.color:"#aaa",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button style={{...S.primaryBtn,marginTop:16}} onClick={()=>{onSave(items);onClose();}}>Save & Close 🐾</button>
      </div>
    </div>
  );
}

// ── design tokens ─────────────────────────────────────────────────────────────
const C = { pink:"#e8527a", blue:"#5b9bd5", green:"#5db887" };

const S = {
  root:{ minHeight:"100vh", background:"#fdf5f8", backgroundImage:"radial-gradient(circle at 20% 10%, #fce7f0 0%, transparent 50%), radial-gradient(circle at 80% 80%, #e8f4ff 0%, transparent 50%)", color:"#3a2a35", fontFamily:"'DM Sans', 'Segoe UI', sans-serif", paddingBottom:50 },
  header:{ background:"linear-gradient(135deg,#fff0f5 0%,#ffe8f5 100%)", borderBottom:"2px solid #fce7f0", padding:"16px 0", boxShadow:"0 2px 12px #f4a7bb22" },
  headerInner:{ maxWidth:740, margin:"0 auto", padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  logo:{ fontSize:24, fontWeight:800, color:"#b5476a", letterSpacing:1 },
  logoSub:{ fontSize:11, color:"#c9a0b0", letterSpacing:2, textTransform:"uppercase" },
  balancePill:{ background:"white", borderRadius:16, padding:"10px 18px", textAlign:"right", border:"2px solid #fce7f0", boxShadow:"0 2px 8px #f4a7bb22" },
  balanceLabel:{ display:"block", fontSize:11, color:"#c9a0b0", letterSpacing:1, textTransform:"uppercase" },
  balanceAmount:{ fontSize:22, fontWeight:800 },
  nav:{ maxWidth:740, margin:"0 auto", padding:"14px 20px 0", display:"flex", gap:6, flexWrap:"wrap" },
  navBtn:{ padding:"8px 14px", borderRadius:20, border:"1.5px solid #fce7f0", background:"white", color:"#c9a0b0", cursor:"pointer", fontSize:13, fontWeight:600, transition:"all .2s", boxShadow:"0 1px 4px #f4a7bb11" },
  navActive:{ background:"linear-gradient(135deg,#f9c8d4,#c4dff5)", color:"#7a3050", borderColor:"#f4a7bb", boxShadow:"0 2px 8px #f4a7bb33" },
  main:{ maxWidth:740, margin:"0 auto", padding:"20px 20px 0" },
  card:{ background:"white", borderRadius:20, padding:24, marginBottom:20, border:"1.5px solid #fce7f0", boxShadow:"0 4px 20px #f4a7bb11" },
  cardTitle:{ margin:0, fontSize:17, fontWeight:800, color:"#b5476a" },
  cardRow:{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 },
  statCard:{ background:"white", borderRadius:16, padding:"16px 18px", border:"1.5px solid #fce7f0", boxShadow:"0 2px 12px #f4a7bb0d" },
  sectTitle:{ fontSize:13, fontWeight:700, color:"#c9a0b0", textTransform:"uppercase", letterSpacing:1, margin:"0 0 10px" },
  formGrid:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 },
  label:{ fontSize:12, color:"#c9a0b0", fontWeight:700, letterSpacing:.3 },
  input:{ background:"#fdf5f8", border:"1.5px solid #fce7f0", borderRadius:10, padding:"9px 12px", color:"#3a2a35", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" },
  preview:{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fdf5f8", borderRadius:12, padding:"10px 14px", marginBottom:16, color:"#c9a0b0", fontSize:14, border:"1px dashed #fce7f0" },
  previewAmt:{ fontSize:22, fontWeight:800, color:C.green },
  primaryBtn:{ width:"100%", padding:"12px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#f4a7bb,#a8d4f5)", color:"white", fontSize:15, fontWeight:800, cursor:"pointer", letterSpacing:.5, boxShadow:"0 3px 12px #f4a7bb44" },
  toggleBtn:{ background:"transparent", border:"1.5px dashed #fce7f0", borderRadius:10, color:"#c9a0b0", padding:"7px 14px", fontSize:12, cursor:"pointer", marginBottom:10, fontFamily:"inherit" },
  list:{ display:"flex", flexDirection:"column", gap:8 },
  listItem:{ background:"#fdf5f8", borderRadius:12, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid #fce7f0" },
  listLeft:{ display:"flex", flexDirection:"column", gap:3 },
  listDate:{ fontSize:14, fontWeight:700, color:"#3a2a35" },
  listSub:{ fontSize:12, color:"#c9a0b0" },
  listRight:{ display:"flex", alignItems:"center", gap:8 },
  listAmt:{ fontSize:16, fontWeight:800 },
  extra:{ fontSize:11, color:"#e8a030", background:"#fff8e0", borderRadius:6, padding:"2px 6px" },
  editBtn:{ background:"transparent", border:"none", cursor:"pointer", fontSize:14, padding:"2px 4px" },
  deleteBtn:{ background:"transparent", border:"none", color:"#e0b0be", cursor:"pointer", fontSize:14, padding:"2px 4px" },
  empty:{ color:"#dbb0c0", fontSize:13, fontStyle:"italic" },
  overlay:{ position:"fixed", inset:0, background:"rgba(180,100,130,0.18)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" },
  modal:{ background:"white", borderRadius:24, padding:28, width:"min(480px,95vw)", border:"2px solid #fce7f0", boxShadow:"0 20px 60px #f4a7bb33" },
  feedbackBtn:{background:"white",border:"1.5px solid #fce7f0",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer",boxShadow:"0 1px 4px #f4a7bb11"},
  clockBanner:{maxWidth:740,margin:"8px auto 0",padding:"10px 20px",background:"linear-gradient(135deg,#fff0f5,#f0f8ff)",borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"#b5476a",border:"1px solid #fce7f0"},
  clockOutBtn:{background:"#e8527a",color:"white",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"},
};
