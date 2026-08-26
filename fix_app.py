#!/usr/bin/env python3

file_path = 'src/server/app.ts'

# اقرا الملف
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# عدّل الكود - شيل الشرط والـ if/else
new_content = content.replace(
    """const distPath = path.resolve(__dirname, '../../dist');
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.use(express.static(distPath));
}

app.get('*', (req, res) => {
  if (isProduction) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});""",
    """const distPath = path.resolve(__dirname, '../../dist');

// خدم الملفات الثابتة من dist
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});"""
)

# اكتب الملف
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ تم تعديل الملف بنجاح!")
