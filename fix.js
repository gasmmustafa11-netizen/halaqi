import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.log("❌ يرجى كتابة المفتاح أولاً!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
// استخدام النموذج المعتمد الموصى به
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

async function fixCode() {
  console.log("🤖 المساعد الذكي يقرأ الكود ويعدل مشكلة الحجز الآن...");
  const path = "src/server/app.ts";
  const appCode = fs.readFileSync(path, "utf-8");
  
  const prompt = `أنت خبير Node.js و TypeScript. عدل الكود التالي لتقفيل السياق: إذا كان salonId موجوداً في الجلسة والمستخدم طلب الحجز، أمنع استدعاء search_salons نهائياً وانتقل للحجز مباشرة. أعطني الكود المعدل فقط دون أي كلام إضافي.
  الكود:
  ${appCode}`;

  try {
    const result = await model.generateContent(prompt);
    let cleanedCode = result.response.text().replace(/```typescript|```/g, '').trim();
    fs.writeFileSync(path, cleanedCode);
    console.log("✅ تم تعديل الملف وتصحيح الذكاء الاصطناعي بنجاح!");
  } catch (err) {
    console.error("❌ حدث خطأ أثناء الاتصال بالنموذج:", err.message);
  }
}

fixCode();
