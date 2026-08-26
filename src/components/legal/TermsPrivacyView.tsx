import React from 'react';
import { ArrowRight, ShieldCheck, FileText, Scale } from 'lucide-react';

interface TermsPrivacyViewProps {
  onBack: () => void;
}

export const TermsPrivacyView: React.FC<TermsPrivacyViewProps> = ({ onBack }) => {
  return (
    <div className="space-y-4 pb-8" dir="rtl">

      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-[#D4AF37] transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى المنصة
        </button>

        <div className="mt-6">
          <h1
            className="text-2xl sm:text-3xl font-black text-white"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            الشروط والأحكام وسياسة الخصوصية
          </h1>

          <p className="text-xs text-gray-500 mt-2">
            منصة حلاقي - Halaqi
          </p>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 sm:p-7 space-y-8">

        <section>
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-lg font-bold text-white">الشروط والأحكام</h2>
          </div>

          <div className="space-y-4 text-sm text-gray-400 leading-7">
            <p>
              باستخدامك منصة حلاقي أو تسجيلك فيها أو الاستفادة من خدماتها،
              فإنك توافق على الالتزام بهذه الشروط والأحكام وجميع السياسات
              المعمول بها داخل المنصة.
            </p>

            <p>
              منصة حلاقي هي منصة إلكترونية تهدف إلى تسهيل اكتشاف صالونات
              الحلاقة ومراكز التجميل وعرض خدماتها وإتاحة الحجز والتواصل
              بين المستخدمين ومقدمي الخدمات.
            </p>

            <p>
              يتحمل كل مستخدم مسؤولية صحة البيانات والمعلومات التي يقدمها
              داخل المنصة، كما يتحمل صاحب الصالون مسؤولية صحة بيانات الصالون
              والخدمات والأسعار والمواعيد التي يعرضها.
            </p>

            <p>
              يمنع استخدام المنصة لأي غرض غير قانوني أو احتيالي أو مسيء،
              أو لمحاولة الإضرار بالمنصة أو مستخدميها أو أصحاب الصالونات،
              أو الوصول غير المصرح به إلى الحسابات أو البيانات أو الأنظمة.
            </p>

            <p>
              يمنع نشر أو إرسال أي محتوى مخالف للقوانين أو الآداب العامة،
              أو يتضمن تهديداً أو ابتزازاً أو احتيالاً أو انتحال شخصية
              أو إساءة متعمدة للآخرين.
            </p>

            <div className="bg-[#1A1A1A] border border-[#3A3020] rounded-xl p-4">
              <h3 className="font-bold text-[#D4AF37] mb-2">
                مخالفة سياقات المنصة
              </h3>
              <p>
                يحق لمنصة حلاقي اتخاذ الإجراءات المناسبة بحق أي شخص يستخدم
                المنصة أو خدماتها في أعمال خارجة عن سياقات المنصة أو لأغراض
                مخالفة للقوانين أو الأنظمة، بما في ذلك تعليق أو حظر الحساب
                ومنع الوصول إلى خدمات المنصة. وفي الحالات التي تستوجب ذلك،
                قد يتم توثيق الواقعة وتقديم بلاغ إلى الجهات الحكومية أو
                المختصة وفقاً للقوانين والإجراءات المعمول بها.
              </p>
            </div>

            <p>
              تحتفظ المنصة بحقها في إيقاف أو تقييد أي حساب يخالف هذه الشروط
              أو يستخدم المنصة بطريقة تضر بالمستخدمين أو المنصة، مع اتخاذ
              الإجراءات المناسبة بحسب طبيعة المخالفة.
            </p>

            <p>
              منصة حلاقي لا تتحمل مسؤولية الاتفاقات أو التعاملات التي تتم
              خارج النظام الرسمي للمنصة بين المستخدم وأي مقدم خدمة، ويجب
              على الأطراف الالتزام بالقوانين والأنظمة المعمول بها.
            </p>
          </div>
        </section>

        <div className="border-t border-[#262626]" />

        <section>
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-lg font-bold text-white">سياسة الخصوصية</h2>
          </div>

          <div className="space-y-4 text-sm text-gray-400 leading-7">
            <p>
              تحترم منصة حلاقي خصوصية مستخدميها وتسعى إلى حماية المعلومات
              التي يتم تقديمها أثناء استخدام المنصة.
            </p>

            <p>
              قد يتم جمع معلومات ضرورية لتشغيل الخدمات، مثل الاسم ورقم
              الهاتف والبريد الإلكتروني وبيانات الحساب والحجوزات ومعلومات
              الصالون والخدمات، وذلك بالقدر اللازم لتقديم وظائف المنصة.
            </p>

            <p>
              تستخدم المعلومات لتوفير الخدمات، إدارة الحسابات والحجوزات،
              تحسين تجربة المستخدم، حماية المنصة من الاستخدام غير المشروع،
              والتواصل مع المستخدم عند الحاجة المتعلقة بالخدمات.
            </p>

            <p>
              لا يجوز للمستخدم محاولة الوصول إلى بيانات مستخدم آخر أو
              الحصول عليها أو استخدامها دون تصريح.
            </p>

            <p>
              تتخذ المنصة إجراءات تقنية وتنظيمية مناسبة للمساعدة في حماية
              البيانات، مع العلم أن أي نظام إلكتروني لا يمكن ضمان حمايته
              بنسبة مطلقة من جميع المخاطر التقنية.
            </p>

            <p>
              قد يتم الاحتفاظ ببعض البيانات بالمدة اللازمة لتقديم الخدمة
              أو للامتثال للمتطلبات القانونية أو لحماية حقوق المنصة
              ومستخدميها.
            </p>
          </div>
        </section>

        <div className="border-t border-[#262626]" />

        <section>
          <div className="flex items-center gap-3 mb-3">
            <Scale className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-lg font-bold text-white">الاستخدام المسؤول</h2>
          </div>

          <p className="text-sm text-gray-400 leading-7">
            استمرارك في استخدام منصة حلاقي يعني موافقتك على استخدام المنصة
            بطريقة مسؤولة وقانونية، واحترام حقوق المستخدمين وأصحاب الصالونات
            والالتزام بالشروط والسياسات المنشورة داخل المنصة.
          </p>
        </section>

        <div className="border-t border-[#262626]" />

        <div className="text-center bg-[#101010] border border-[#262626] rounded-2xl p-5">
          <p className="text-sm text-gray-400">
            تم تصميم وتطوير منصة حلاقي من قبل المطور{' '}
            <span className="text-[#D4AF37] font-bold">مصطفى كامل</span>.
          </p>

          <p className="text-[11px] text-gray-500 mt-2">
            © 2026 منصة حلاقي - جميع الحقوق محفوظة.
          </p>
        </div>

      </div>
    </div>
  );
};
