import express from 'express';
import axios from "axios";
// import translate from 'google-translate-api-x';
import { translate } from 'bing-translate-api';

import { OpenAIEmbeddings } from "@langchain/openai";

import { ChromaClient } from 'chromadb';



const embeddingsProvider = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY, model: "text-embedding-3-small" });

const chroma = new ChromaClient({ path: "http://138.197.231.101:8000" });

const collection = await chroma.getOrCreateCollection({ name: "langchain" });


const router = express.Router();



import mongoose from 'mongoose';

const whatsappMessageSchema = new mongoose.Schema({
    from: { type: String, required: true }, // Sender's phone number
    name: { type: String }, // Sender's name
    messageId: { type: String, required: true }, // Unique message ID
    timestamp: { type: Date, required: true }, // Timestamp of the message
    text: { type: String, required: true }, // The actual message text
    textEnglish: { type: String },
    botReply: { type: String }, // The bot's reply
    botReplySindhi: { type: String }, // The bot's reply in Sindhi
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

const WhatsappMessage = mongoose.model('WhatsappMessage', whatsappMessageSchema);


const SiyarnoonSindhiSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: { type: String },
    searchable_tags: { type: String, required: true },
});

const SiyarnoonSindhi = mongoose.model('siyarnoonsindhi', SiyarnoonSindhiSchema, "siyarnoonsindhi");


const TRANSLATE_OUTPUTS = false; // Set to true to enable translation of bot replies


import { getChatCompletion } from "../../utils/openai.js";


let smallTalk = [
    "ڪهڙا حال آهن؟",
    "توهان ڪيئن آهيو؟",
    "توهان ڪينئن آهيو؟",
    "ڪهڙا حال اٿئي؟",
    "هيلو",
    "هيلو!",
    "هيلو, ڪيئن آهيو؟",
    "خوش چاڪ چڱون ڀلو",
    "اسلام عليڪم",
    "وعليڪم اسلام",
    "وعليڪم اسلام!",
    "سلام",
    "سلام!",
    "سلام, ڪيئن آهيو؟",
    "اڇا",
    "اچها",
    "اڇا!",
    "اچها!",
    "اڇها",
];



const generateMetaDataTopic = async ({ alternateMessages, messagesHistory }) => {
    if (!alternateMessages) {
        throw new Error("alternateMessages are required");
    }

    if (Array.isArray(alternateMessages)) {
        alternateMessages = alternateMessages.join("\n");
    }

    const instructionMessage = {
        role: 'system',
        content: `
            You are a helpful assistant that tells me which topic user is talking about. User's way of saying maybe different, he can make typing mistakes or can write topic names incorrect. Your job is to check a list and is there anything in the list that matches what user is talking about and return that exact element from list otherwise return none.
            \n\n
            List: مسرور پيرزادو, الطاف شيخ, سلطانہ وقاصي, ڊاڪٽر نبي بخش بلوچ, مھراڻ ملاح, روزينہ جوڻيجو, محمد علي مانجهي, موتي پرڪاش, سر جارج ميڪمين, ھري موٽواڻي, نور محمد ڀٽو, غلام نبي سومرو, رجب آزاد, محمد يوسف شيخ, حاڪم علي ڪٽوھر, سائين بخش رند, عابد لغاري, حميدہ گهانگهرو, ڀورو مل چنديرام, اوريانا فلاسي, چاچا محمد علي لغاري, نصير مرزا, سڪندر ملاح, عزيز گوپانگ, لالڻ چنا, ممتاز مرزا, پروفيسر ڊاڪٽر خان محمد لاڙڪ, سرمد عباسي, ملھار سنڌي, غلام نبي صابر سڌايو, اختر بلوچ, ايڇ ٽي سورلي, پريتم پياسي, ذوالفقار سيال, ڊاڪٽر ميمڻ عبدالمجيد سنڌي, ڊاڪٽر محمد عالم سومرو, ڊاڪٽر عبدالجبار جوڻيجو, محمد يعقوب آغا, زاھدہ ابڙو, غلام محمد گرامي, تنوير جوڻيجو, مشتاق ڀرڳڙي, ممتاز مھر, سڪندر مگسي, ڊاڪٽر مرتضيٰ کوسو, عبدالحڪيم ارشد, منصور ملڪ, رخسانہ پريت, امجد دراني, خادم حسين ابڙو, غوث پيرزادو, وشال امير, علامہ صفي الرحمان مبارڪپوري, سنڌ سلامت, فقير عبدالله ٿھيم, ناديا مسند, موھن ھمٿاڻي, نند ڪمار سنمُکاڻي, پريم پرڪاش, محمد جمن ڄامڙو, ارنيسٽ ٽرمپ, ڪنعيو ماندو, عاجز ميرواھي, دادن فقير, سردار الطاف حسين جوکيو, علي گل کوسو, زبيدہ ميتلو, ستايل سڪندر, سرور سيف, علي عاجز شر, امين ارباب, مارو جمالي, جعفر جاني, خواجہ فريد الدين عطار, ائن مورا, خ . ق . سومرو, آئتوان دُسينتيگزيپيگي, شفقت قادري, جاويد عباسي, ارشاد ساگر گڏاڻي, خالد آزاد, مير علي شير قانع ٺٽوي, سيد حسام الدين راشدي, مراد علي خاصخيلي, آزاد انور ڪانڌڙو, عبدالستار ڀٽي, زبيدہ مصطفيٰ, ھدايت پريم, شيخ محمد ابراھيم خليل, الطاف ملڪاڻي, ضمير, ايلن گرانٽ, يوحان گولف گوئٽي, ڄيٺمل پرسرام, اوڪيش ڪمار کتري, لطف الله بدوي, حافظ عبدالرحيم خالد جمالي, راورٽي, صادق علي ملڪ, راھب علي لاڙڪ, ليوند بريزنيف, محمد اسماعيل راھو, پنا لال پٽيل, شيوڪ ڀوڄراڄ, پروفيسر نارائڻداس رتنمل ملڪاڻي, حبيب اللہ صديقي, جوهر بروهي, محمد عثمان ڏيپلائي, م ن محزون, فيودور دوستو وسڪي, احسان بدوي, منٺار سولنگي, شيخ عزيز, نواز ڪنڀر, ليئو ٽالسٽاءِ, بھاري لال, نسيم حجازي, ڊاڪٽر منظور احمد عرساڻي, سراج الحق ميمڻ, شولوخوف, عمر ميمڻ, ڊاڪٽر الھرکيو ٻُٽ, محمد بخش سومرو, انجنيئر احسان احمد عرساڻي, ڊاڪٽر احمد نواز هڪڙو, ذوالفقار ڪانڌڙو, پروفيسر ستار سومرو, اياز لطيف دايو, سيد رکيل شاھ, هارون يحيٰ, ھرشا موُلچنداڻي "سرِتا", جي ايم لاڙڪ, ڪشور لالواڻي, اسلم سنديلو, ٿامس پين, چارلس شا, جهمٽمل نارومل وسڻائيءَ, غلام محمد غازي, غلام رسول "سومرہ" سودائي, خيال کتري, آبادگار ائسوسيئيشن, خوش خير محمد ھيسباڻي, فقير قادر بخش بيدل, جان خاصخيلي, مجتبيٰ راشدي, منصور قادر جوڻيجو, سيتا رام ڪوھلي, رشمي راماڻي, رياض مشوري, علي منصور, تنوير عباسي, زيد پيرزادو, چي گويرا, جان بيمز, گل محمد تنيو, نانڪ يوسف, فقير عبد الله ڪاتيار, ڀڳوان ٻاٻاڻي 'بندو', ول ڊيورانٽ, علي راز شر, رابرٽ گرين انگرسال, زيب سنڌي, ميخائيل ايلين, ايلينا سيگال, علي گل سانگي, عبدالسلام ڀٽو, خاڪي جويو, ڪامريڊ مانڌل شر, انور ڏنگڙائي, رسول بخش درس, رتن دلبر, سارنگ درس, پروفيسر حبيب الله رحيم بخش مرزا, جان اسٽوئرٽ مل, شبير احمد ڀٽو, سر جيمس جارج فريزر, جيمس ھيمنگ, سيد امداد محمد شاھ, ماڻڪ ملاح, احمد خان مدھوش, بخاري افضل, محمد خان غني, اسلم خواجا, نعمت الله ڀٽو, برڪت علي ڀٽو, صفدر گاڏھي النجفي, مفتي محمد عبدالواحد عباسي سڪندري, مولوي احمد ملاح, پروفيسر ضرار رستماڻي, توراڪينہ قاضي, ظفر, فقير غلام علي مسرور بدوي, لياقت عزيز, سليم بچاڻي, فقير محمد لاشاري, احسان حليم, پروفيسر زاھد علي مگسي, الله بچايو يار محمد سمون, محمد حسين ڪاشف, حبيب الله مولا بخش ڀٽو, عبدالرحمان, وفا چولياڻي, ناچيز کيمچند لوھاڻو, فيض احمد فيض, ڊاڪٽر سحر امداد, پروفيسر عبدالغني فاروق, عبدالھادي ٿيٻو, حسن وساڻ, مرزا عطا محمد شڪارپوري, حڪيم نياز ھمايوني, گل محمد سومرو, نثار بزمي, لعل پشپ, ھينري رائڊر ھيگرڊ, رياض حسين ميمڻ, جاني ٻائي ميگهواڙ, لڇمڻ ساٿي, علي محمد "درد" سولنگي, رئيس شمس الدين "بلبل", برڪت جيھو, شفيع چانڊيو, سرمد عثمان, احقر الانام عبدالواحد شيخ ٿريچاڻوي, صراط بلوچ, محسن ڪڪڙائي, ماھين ھيسباڻي, سڪندر ھاڙھو, لي دوئان, رابيل, ظفر پياروي, رجنيش اوشو, اشتياق انصاري, سيد صباح الدين عبدالرحمان, امام راشدي, منور سلطانہ, رياض ڪلهوڙو, گرداس واڌواڻي, محمد پناھ ڦرڙو, ونسٽن چرچل, محمد احمد منصور عباسي, ڪشنچند بيوس, خانبھادر خداداد خان, عمر الدين بيدار, سرور نواز ٻگهيو, مائيڪل ايل ھينيگر, محمد الياس رضوي, آندري گروميڪو, امير ابڙو, مخدوم محمد زمان طالب المولا, محمد جواڻ "جانب" سومرو, ايوب گاد, ستار رند, شيخ عبدالحليم جوش, محمد مسعود کدرپوش, مير سردار چنڙ, علي شيرازي, ڊاڪٽر غلام قادر سومرو, ڪرم الاھي چنا, طارق قريشي, جڳت آڏواڻي, قبول ابڙو, رشيد آخوند, لياقت رضوي, مولانا قاضي محمد عثمان (مرحوم) حال ٿريچاڻي (سانگي), رابندر ناٿ ٽئگور, چوھڙ مل ھندوجا, زان پال سارتر, يوسف شاھين, شيخ عبد الرزاق راز, رشيد احمد لاشاري, اياز جاني, زوار نقوي, منير سولنگي, ھرمن ھيس, عبدالواحد شيخ ٿريچاڻوي, الھڏنو ڪاڪا, پروفيسر ايسرداس واڌومل رائسنگهاڻي, اختر افروز شاھ, پرل ايس بڪ, بھاري لال ڇاٻڙيا, سحر گل, ڌرم وير ڀارتي, ڀڳت سنگهہ, سئم سنڌي, سردار شاھ, رشيد ڪليري, الطاف اثيم, گيارگي پليخانوف, مرتضيٰ لغاري, معمور يوسفاڻي, سيد نجف علي شاھ "ڪمتر" نقوي, ايم ڪمل, شيخ محمد ابراهيم 'خليل', غلام مصطفيٰ 'مشتاق' ميمڻ, آسانند ڇتارام گياناڻي, اتم, وسيم آڪاش سيتائي, سيف الحق سيف, اگناٿ ھرمين, ڄام نذير احمد راھوجا, محمد انور بلوچ, اختر رند, آنھ ڊڪ, "راز" علي گل ڀُٽو, ساڀيان سانگي, ادريس لغاري, ڪنعيا لعل ايم تلريجا, نسيم کرل, فقير محمد سچل لاڙڪ, مدھوش مير, پروفيسر محمد شريف "شاد" سومرو, گهايل لغاري, زين کوسو, جاويد نواز جاويد, حسين سرور, آخوند محمد عباس, بادل جمالي, سرمد بروھي, سجاد ميراڻي, عبدالقيوم بيدار, محمد صديق مسافر, ڊاڪٽر ام ڪلثوم شاھہ, امان شيخ, ڀڳت ڪبير, لياقت علي لياقت, سنڌو پيرزادہ, لوڪرام ڏوڏيجا, پير عالي شاھہ جيلاني, سيد غلام حيدر شاھ قلندري, سيال حيات, رحيمداد خان مولائي شيدائي, خانبھادر محمد صديق ميمڻ, پير تاج محمد قريشي, ميمڻ روشن تبسم, مشتاق جروار, علي اصغر اوٺو, محمد جمن ھالو, حڪيم پريم چاندواڻي, عبدالطيف راز بلڙائي, اويس ساگر سومرو, احسان دانش, ثميرہ زرين, اياز لطيف پليجو, نصرت لاشاري, سارنگ لاشاري, محمد حفيظ سيد, ڊاڪٽر جيت سنگهہ سيتل, زرقا عباسي, نرمل جيوتاڻي, يوسف ميرڪ بن ابوالقاسم "نمڪين", شاهده کوکر, پريم پتافي, رولاڪ آصف ڪالرو, مسافر ھاليپوٽو, احمد شاڪر, حڪيم فتح محمد سيوھاڻي, ميخائيل نعيمي, پير ابراھيم جان خليل سرھندي, ارشاد سومرو, سجاد گهلو, نجيب الله کوهارو, حڪيم عبدالقيوم 'زخمي' هالائي, خادم گهراڻو, سيد منظور نقوي, امداد سھتو, ڊاڪٽر عبدالجبار عابد لغاري, رچرڊ ايف. برٽن, چارلس ڊارون, سانوڻ راڄڙ, فاطمہ جناح, شريف المجاھد, فقير امداد علي سرائي, ميان مير چانڊيو, ڀيرومل مھرچند آڏواڻي, ابدال بيلا, جيا جادواڻي, سليم حيدري, ڊاڪٽر غلام رسول سومرو, مسڪين جھان خان کوسو, محمد بخش بلوچ "مجنون", ڊاڪٽر قريشي حامد علي خانائي, محمد سومار شيخ, راز شاھاڻي, لال جروار, ڪوڙومل چندن مل کلناڻي, اسماعيل خاصخيلي, ادا قاضي, مولانا الحاج رحيم بخش قمر لاکو, عاشق حسين ميمڻ, ڊاڪٽر شازيہ سفير, ضياءُ الدين آغا, مراد علي مرزا, ڊاڪٽر منوھر بختراءِ مٽلاڻي, ڊاڪٽر عبدالعزيز رحماني ڪنڀار, ايم اي عالماڻي, انجنيئر عبدالوھاب سھتو, استاد امير علي خان, پروفيسر ڪريم بخش نظاماڻي, ڊاڪٽر آفتاب ابڙو, مير عبدالحسين سانگي, عبدالرسول قادري بلوچ, ناز سنائي, ايڇ. آءِ سدارنگاڻي, پروفيسر نارائڻداس ڀمڀاڻي, تاج محمد شيخ, منظور احمد قناصرو, الله بخش حسين بخش ٽالپر, ايس نرگس حق, پروفيسر امينہ خميساڻي, شبير شر, رحمت الله وساڻ, روبن شرما, محمد طارق مھيسر, ابراھيم اميني, شبانہ سولنگي, مور سنڌي, الطاف قادري, منظور ڪوهيار, وفا جانوري, عزيز ڀنڀرو, پوپٽي ھيراننداڻي, شاھنواز پيرزادو, سڪندر سرواڻ, عنايت حسين رند, محمد ايوب "عارض" واھوچو, امر کھاوڙ, دوست سومرو, وسند چوھاڻ, حيدر دريا زئور, ديوان ڪيولرام سلامتراءِ آڏواڻي, والٽيئر, ڊاڪٽر عطا محمد حامي, زيب ڀٽي, ايشور چندر, خليفو گل محمد 'گل' ھالائي, محمد اسماعيل بن "واصف", انمول نظاماڻي, منگهارام اوجها, زيب ڪنگو, مبين اڄڻ, بخشل باغي, وفا غلام عباس خاصخيلي, مشتاق ڪلھوڙو, اليور گولڊسمٿ, احمد خان محمود خان ميمڻ, مشتاق بخاري, مبين چنا, شرت چندر چيٽرجي, انير, انور ڪليم, نور ڪنڀر, ڄاڃي لعل.ڊي . آهوجا 'طائر', سيد محمد فاضل شاھہ, آزاد مري, امرتا سٿ, ھدايت علي باريچو, شعيب محمد انور, شعيب احمد ائنڊ برادرس, ڊاڪٽر محمد الياس ڀٽو, لکاڏنو "ڪلال" خاصخيلي, عبدالرزاق سومرو, ڊاڪٽر جڳديش لڇاڻي, ڊاڪٽر عبد الڪريم سنديلو, ڪيرن آرم اسٽرانگ, منور ٻُٽ, راجندر سنگهہ بيدي, لڇمڻ ڪومل, شبير حسن گبول, سارنگ شاھہ, جان ڪيننگ, آشا ايس نلسن, خادم ٽالپر, ڀاڳيتا, مولانا در محمد ڪانڌڙو خاڪ, دانش چاگلاڻي, دانش نواز, عبدالحق عالماڻي, استاد اِمن آزاد مانجهي, استاد حُبدار علي چانگ, غلام عباس چانگ, مولانا ابوالاعليٰ مودودي, سليم جمالي, ڄام وقار حسين, جسٽس امير علي, شمس الدين تنيو لاڙڪاڻوي, ظھير لاڙڪ, ڊي ڪين, دانش ضياء, سيد ابو الاعليٰ مودودي, خدا بخش مغل, حافظ بدرالدين, پير علي محمد راشدي, سيدہ سعديہ غزنوي, پروفيسر محمد مبين وساڻ, شاهد علي "صوف" ابڙو, نورالدين سرڪي, سرمد لطيف, مولوي عبدالرحيم مگسي, عبد ﷲ عثمان مورائي, سبينا شھباز عيساڻي, فقير يونس سومرو, ساحل سومرو, استاد نظاماڻي, ايم اين راءِ, عبد ﷲ الفائز, جان ڪوليئر, ڪيرت مھرچنداڻي, مير غلام ﷲ خان ٽالپر "مير", قطب الدين لغاري, مير بلوچ, عزيز قاسماڻي, محمد خان سميجو, خواجہ احمد عباس, آدرش, عبدﷲ 'آس' هنڱورجو, محبوب ڀٽي, ايوب خاصخيلي, عائشه ميمڻ, امين جويو, قاضي نذرالاسلام, انور ضياءَ عباسي, نرنجن دوداڻي, البرتو موراويا, مرزا سڪندر علي بيگ, تمر فقير, سيد قادن شاھہ بخاري, مولانا عبدالغفور 'مفتون' ھمايوني, منير احمد, گينرخ وولڪوف, ڊاڪٽر اديب انقلابي, شاھہ لطف ﷲ قادري, نسيم بخاري, سيد عبدالغفار شاھہ راشدي "حسيني", عبدالجبار "عبد", نياز پنھور, بيخود بلوچ, سليم چنا, امين لغاري, لطيف اياز پنھور, نورالھديٰ شاھہ, الاهي بخش سانگي, ٻاجهي فقير لغاري, ڊاڪٽر عائشہ الشاطي مصري, عصمت چغتائي, غمدل فقير, ذوالقرنين "مزمل" ابڙو", ڪرسٽوفر نڪول, "بيوس" بخش علي چانڊيو, غلام جعفر سومرو, فقير ڪمال, گل محمد گل سومرو, آفتاب احمد, ڊاڪٽر محمد اسماعيل ماڪو, منظور احمد چانڊيو, نسيم ٿيٻو, دين محمد ڪلھوڙو, پروفيسر ساجد سومرو, ڊاڪٽر محمد ابراھيم پنھور, سومرو شبير احمد, غلام مصطفيٰ سولنگي, ڊاڪٽر خالد نوناري, عاشق منگي, ڊاڪٽر محمد لائق زرداري, نور راھوجو, رئيس ڪريم بخش نظاماڻي, سجاد احمد پنھور, محمد عثمان منگي, ايڊورڊ گبن, مرتضيٰ سيال, غلام علي لانا "عاجز", الطاف آگرو, پيراڻو سائل ڀنڀرو, روي پرڪاش ٽيڪچنداڻي, ڊاڪٽر مجيب اقبال سومرو, سچل سرمست, پروفيسر رام پنجواڻي, فتح محمد شھزاد "فتح ٿيٻو", وفا مولا بخش, پروفيسر محبوب علي چنا, مخدوم امين محمد (ثالث "3"), شيخ سعدي شيرازي, مايا وسنداڻي, پانڌي آريسر, مصطفيٰ آڪاش, محمد موسيٰ ڀٽو, حافظ محمد اسلم مھيسر رفيقوي, امتياز حسين مھيسر, جيف ڪيلر, جھان آرا سومرو, دادن ثقلين لاشاري, محمد خان سيال, ڊاڪٽر محمد جمن ٽالپر, آغا قيوم, مولانا حافظ محمد رمضان مھيري, سعيد ميمڻ, ڊاڪٽر سرلا ديوي, ڊاڪٽر ابوسلمان شاهه جهانپوري, جمال ابڙو, خليل جبران, امداد ڪانهيو, امتياز منگي, جبار آزاد منگي, ستار سُندر, رسول بخش پليجو, محمد ابراھيم جويو, آغا سليم, سيد عطا حسين موسوي, حاجي عبدالڪريم سنگهار, علي محمد شاهه لڪياري, نجم عباسي, عبدالحئي پليجو, مخدوم شبير احمد, رڪ سنڌي, حليم باغي, بابر جاگيراڻي, حبيب سنائي, ڊاڪٽر نياز ڪالاڻي, ارم فاروق جمالي, تيرٿداس پيسومل ھاٿيراماڻي, مظفر چانڊيو, اعجاز مهر, صدا لاشاري, انجنيئر شفقت حسين وڌو, عبدالرزاق عبدالسلام, ڪرشن چندر, مزمل سائر, عزيز رانجهاڻي, ڪانسٽينٽن ورجل جارج, ڊاڪٽر الطاف جاويد, منور سراج, علي بابا, حسيب ڪانهيو, ھولارام تيجورام شرما, روچي رام, مولانا وحيدالدين خان, علامھ علي خان ابڙو, پيارو شواڻي, يوسف سنڌي, اياز رضوي, محب ڀيل, رحيم خاصخيلي, ڪلاڌر مُتوا, قاسم پٿر, آغا ممتاز حسين خان دراني, خواجہ محمد زمان لواري, اشرف پلي, منظور ٿھيم, فقير الله بچايو لغاري, لطيف جمال, علي احمد بروهي, امان ﷲ شيخ, وِمي سَدارنگاڻي, علي نواز آريسر, قاضي مقصود احمد, يوسف هاشمي, ڊاڪٽر شير مھراڻي, نند جويري, گل نصرپوري, سارنگ سهتو, فهميده شرف بلوچ, مخمور رضا, اقرار پيرزادو, استاد خالد چانڊيو, عيسى ميمڻ, ڊاڪٽر مير عالم مري, سعد الله "سپاهي" ابڙو, مولا بخش چانڊيو, سجاد مهر, ادل سومرو, رزاق مھر, نثار کوکر, اياز گل, موريل زهراڻي, علي رضا قاضي, ادل سولنگي, مهراڻ ايوب, مريم مجيدي, خالده سحر سومرو, علي بخش پٺاڻ, ايوب کوسو, جاويد جبار دائودپوٽو, سرور منگي, فقير محمد سنڌي, غلام شبير پيراهين, زخمي چانڊيو, خواجه غلام علي کوساڻي, واحد ''سوز'' ملاح, صوفي شاعر مهدي سائين, نور گهلو, شمشير الحيدري, عاجز رحمت ﷲ لاشاري, سيد مرتضيٰ ڏاڏاهي, احمد سولنگي, شيخ اياز, مور ساگر, اسحاق سميجو, ضمير کرل, ذوالفقار هاليپوٽو, روپو ريجهو مل ڪرپالاڻي, اويس ڀٽو, گوهر سنڌي, نصير اعجاز, ماڻڪ ڪنگراڻي, رسول بخش انڙ, عزيز ڪنگراڻي, عبدالحق ساريو, مولوي محمد يامين شورو, فهيم نوناري, تانيا ٿيٻو, محمد اسماعيل عرساڻي, ناشاد رحم علي, مختلف ڪهاڻيڪار, نواز خان زئور, عباس سارنگ, ادريس عاجز عباسي, امر رائيسنگهہ راجپوت, عبدالغني شر, ڊاڪٽر آڪاش انصاري, عطا دل, ارڏو اترادي, چندر ڪيسواڻي, رحيم داد جوڳي, دليپ دوشي لوهاڻو, ابو ايليا, ڊاڪٽر ونود آسوداڻي, مولوي عبيدالله چانهيون, حزب ﷲ آءِ سومرو, جلال ڪوري, مير غلام اڪبر "مشتاق", صابر سيدپوري, شهبان سهتو, اسحاق انصاري, عبدالواحد سومرو, حافظ نظاماڻي, يار محمد چانڊيو, قريشي نعيم الله "صابر", صوفي نيڀراج, ساجد سنڌي, حسيب ناياب منگي, طارق عالم, احسان آڪاش, امداد سولنگي, مولانا شعيب الرحمٰن کهڙو, فياض ڏاهري, ڪليم ٻُٽ, کيمن يوُ، موُلاڻي, عبدالخالق سنديلو, عبدالستار عباسي, امر جليل, استاد بخاري, مولائي ملاح, چمن آر ٿري, ٺٽوي ڪاتيار, مير محمد پيرزادو, حسن درس, شاهد حميد, هدايت منگي, ريٽا شهاڻي, رسول ميمڻ, علامہ آءِ آءِ قاضي, پروفيسر غلام رسول اڪرم سومرو, علي اظهار, اڪبر اديب, شالني ساگر, ڄيٺو لالواڻي, قربان منگي, عبدالسلام ٿھيم, ماھتاب محبوب, حسين جاگيراڻي, وفا ناٿن شاهي, حبدار سولنگي, بدر شاهه, اختر درگاهي, ڪلا پرڪاش, سنڌي ادبي سنگت, بشير سيتائي, شبنم گل, اقبال بلوچ, علي قاضي, سومار سنگم مڱڻهار, طارق خشڪ, جميل سومرو, درگاهي گبول, ياسر قاضي, علي حسن سرڪي, فياض منصور, عثمان راهوڪڙو, اندرا شبنم پوناوالا, مانجھي زرداري, ساحر راهو, سيد سراج, سجاد اختر ٽالپر, نماڻو صديق مهيسر, نصير ڪنڀر, سندري اتمچنداڻي, پروفيسر مختيار سمون, اياز امر شيخ, غلام نبي مغل, وفا صالح راڄپر, عنايت بلوچ, ربڏنو خاصخيلي, امر اقبال, عرفان لنڊُ, بيدل مسرور, سرويچ سجاولي, ڊاڪٽر منصور ٿلھو, رئوف نظاماڻي, اخلاق انصاري, ڪوثر ٻرڙو, طارق اشرف, پروفيسر سروپچندر شاد, ابراهيم منشي, امر ساھڙ, ڊاڪٽر مخمور بُخاري, ماڻڪ, قمر شھباز, ڀوَن سنڌي, آزاد بخاري, غلام عباس ڀنڀرو, ڊاڪٽر احمد علي قريشي, پروفيسر ڊاڪٽر عبدالغفور ميمڻ, استاد پيرل قمبر, غلام حيدر گبول, خدا بخش "خاضع", حفي الحفيظ "الحفن", مشتاق سعيد, شهمير سومرو, غلام نبي گل, نورسنڌي, چيتن ميگهواڙ, محمد اسلم ڀٽو, تسليم سحر, وحيد محسن, محمد ٻارڻ, سهيل ابڙو, ڊاڪٽر اياز قادري, ناصر زهراڻي, وينا شرنگي, جمال مراد گبول, فرزانه شاهين, همير چانڊيو, يوسف جميل لغاري, محمود مغل, انور ابڙو, خادم گهڃو, ثمينه ميمڻ, مولانا دين محمد وفائي, علي حسن چانڊيو, قاضي خادم, عريشا بخاري, سيد چيزل شاهه, نامديو تاراچنداڻي, ممتاز مصطفيٰ "دوست", عبد سنڌي, پروفيسر غلام حسين جلباڻي, محمد صالح کھڙو, دلبر چانڊيو, امير بخش شر, اصغر پتافي, استاد حيدري چانڊيو, هوش محمد ڀٽي, زاھد راڄپر, عباس ڪوريجو, علامہ عبدالوحيد جان سرهندي, نور محمد نور سومرو, اصغر جتوئي, انجم قاضي, جاويد جوکيو, حليم بروهي, ڊاڪٽر فهميده حسين, ع.ق.شيخ, اويس قرني, اختر حفيظ, فهيم فدا شورو, شبير حسين "شبير", شاهجھان سمون, لڪشمڻ ديو بجلاڻي, زاھدہ تاج ابڙو, قادر سيال جهڏائي, نواز سومرو, شمس العلماء مرزا قليچ بيگ, پرويز, ابوبڪر خان مگسي, امداد رند, مهراڻ ڌامراهو, گوهر گل ڳورڙ, محمد ابراهيم عباسي, صالح عباسي, پاويل جوڻيجو, واحد ڪانڌڙو, چيتنرام بولچند ٽھلراماڻي, عابده گهانگهرو, شمس ابن ضيا ابن بلبل, ثاقب بلوچ, غلام محمد لاکو, لؤنگ خان عاجز ڀاڻو, عبدالقادر جوڻيجو, آفتاب ميمڻ, شگفته شاهه, ڊاڪٽر شمس الدين عرساڻي, پروفيسر ڪي. ايس. ناگپال, حبيب الله سانگي سجاولي, سيد يار محمد شاهه, فضل الرحمٰن ميمڻ, پروين موسيٰ ميمڻ, غلام رسول پرهياڙ, پير بخش 'پياسي', ڊاڪٽر نواز علي شوق, ڊاڪٽر شاھمراد چانڊيو, ڪلياڻ آڏواڻي, فريد ڀٽو, ڪامل امداد جتوئي, جي ايم سيد, امداد حسيني, راشد شر, محمد علي شيخ, بلوچ صحبت علي, ڊاڪٽر آمنه سومرو, محمد دين راڄڙي, اسلم عباسي, نور الدين "نفيس", عبدالغفار "تبسم", ڊاڪٽر ساجده پروين, خان محمد "خاطي" ڪيريو, مور مغيري, شبير سيال, ضراب حيدر, ڊاڪٽر فيض جوڻيجو, امر پيرزادو, گلزار ڪلهوڙو پاٽائي, علي نواز ڏاهري, ج.ع منگهاڻي, جمن احمداڻي, جھانگير عباسي, عبدالقادر منگي, زاهد شيخ, رياضت ٻرڙو, ذوالفقار علي ڀٽو, غلام رباني آگرو, مختار جانوري, وفا اسلم شيخ, عاشق بلوچ, روشن شيخ, رفيق کوسو, ڊاڪٽر عبدالحفيظ لغاري, فياض لطيف, نور احمد جنجهي, نظام الدين لغاري, طارق عزيز شيخ, ساجد حسين سومرو, مصور حسين, لطف پيرزادو, مشتاق ڦل, اظھر امر, عنايت کٽياڻ, انعام جتوئي, ملڪ آگاڻي, عبدالحفيظ ڀٽي, ڊاڪٽر راڻا سي راٺوڙ, جامي چانڊيو, ڊاڪٽر خير محمد پيرزادو, ڪرشن کٽواڻي, مخدوم امير احمد, ڊاڪٽر گورڌن ولاسائي, رضوان گل, فقير حاجن نظاماڻي, مرتضيٰ ناريجو, وفا گولو, همسفر گاڏهي, نادر دايو, منظور حسين لغاري, راجن مڱريو, استاد گل دايو, عزيز ڏاهري, ڊاڪٽر غلام نبي سڌايو, بشير منگي, ڊاڪٽر بدر اڄڻ, ڊاڪٽر ڪمال ڄامڙو, اياز ڀاڳت, ستار سروهي, جسٽس (ر) سيد ديدار حسين شاھہ, احساس ميرل سھتو, شوڪت حسين شورو, شبانه عالماڻي, علي حسن "احسن" چڍڙ, فقير فولاد علي, ستار پيرزادو, نياز ھمايوني, موھن ڪلپنا, ڊاڪٽر بشير احمد شاد, شيام ڪمار, حميد سنڌي, استاد لغاري, ظفر حسن, نذير سومرو, حق نواز شيراز چانڊيو, ڊاڪٽر سرور خاصخيلي, حاڪم گل, پروفيسر نذير احمد سومرو, ڊاڪٽر مالا ڪئلاش, حڪيم دين محمد اڪرم ٻورڙائي, ڊاڪٽر عبدالرحمان جسڪاڻي, محمد شوڪت علي پيرزادو, سيد غلام مصطفيٰ شاهه, سيد اظھر گيلاني, حيدر بخش جتوئي, عثمان علي انصاري, تاجل بيوس, دادا سنڌي, بدر ابڙو, ڊاڪٽر دودو مھيري, قاضي فيض محمد, محمد علي پٺاڻ, جاويد سومرو, مير عبدالرسول مير, رحمت الله ماڃوٺي, ڊاڪٽر هوتچند مولچند گربخشاڻي, پروفيسر رشيدہ ڀٽي, زرينه بلوچ, ڪامريڊ غلام محمد لغاري, الھورايو بھڻ, سيٺ نائونمل ھوتچند, مير نادر علي ابڙو, امرتا پريتم, ممتاز بخاري, عزيز ڀنگوار, ڊاڪٽر غلام علي همت علي سانگي, گيتا سنڌي, گوبند مالھي, اقبال ملاح, نويد سنديلو, شاھہ محمد پيرزادو, ھيرو ٺڪر, انعام شيخ, علي احمد قريشي, مشتاق شورو, ڊاڪٽر غلام علي الانا, آزاد قاضي, سوز ھالائي, اي جي اتم, علي زاھد, پريا وڇاڻي, نور الصباح قاضي, فراق ھاليپوٽو, مدد علي سنڌي, ڪامريڊ مير محمد ٽالپر, ڪيرت ٻاٻاڻي, پروفيسر شيوارام نرسنگهداس ڦيرواڻي, رضا بخاري, وفا حاڪم وساڻ, ذلفي زنئور, غلام اصغر ونڊير, نارايڻ شيام, مير نصرت حسين ابڙو, خير محمد ٻرڙو سيوھاڻي, نصير ميمڻ, ڊاڪٽر محبوب شيخ, آفتاب سومرو, رمضان راھي, ڊاڪٽر محمد سليمان شيخ, نبي بخش کوسو, رکيل مورائي, امر ثناءَ, آغا تاج محمد خان, ھيرو شيوڪاڻي, جمال الدين ھوت خان خاصخيلي, حاجي حقير ابن مڱڻ, چونڊ لطيفا, ياسمين چانڊيو, عبدالرحمٰن پيرزادو, ظفر عباسي, مرتضى ناز, ڀائو محمد اسماعيل سيلرو, عبدالواحد آريسر, پارس حميد, گوبند خوشحالاڻي, امر گوپالاڻي, ظفر جوڻيجو, اڪبر سومرو, سوڀو گيانچنداڻي, خليق ٻگهيو, هدايت بلوچ, نظر لاکائي, محمد موسا ڪمال خان انڙ, شڪيل احمد, رفيق احمد جعفري, محمد امين مگسي, خليل مورياڻي, عبدالخالق جوڻيجو, سعيد سومرو, فضل احمد بچاڻي, جهانگير راهوجو, شير محمد خدا بخش عالماڻي, ڊاڪٽر مقبول "مارو", شفيع بڪڪ, محمد عمر, مٺل جسڪاڻي, آسي زميني, جوسٽين گارڊر, حبيب ساجد, ابراھيم کرل, علي عابد, نٽ ھمسن, محمد مجيب, علي ھينري, حڪيم عبدالرؤف ڪياني, ڊاڪٽر محمد امجد ثاقب, پروفيسر عطاءُ اللہ ابڙو, شيخ عبدالمجيد سنڌي, خان محمد پنھور, گل حسن گل ملڪ, ڊاڪٽراي ڪي پنجواڻي, گارفيلڊ ڪنگ, نزار قاباني, محبوب علي جوکيو, تاج بلوچ, مشڪور ڦلڪارو, ڊاڪٽر سڪندر مغل, انور علي عباسي, مختيار احمد ملاح, فخر زمان, ولي رام ولڀ, خير النساءِ جعفري, قرت العين حيدر, منصور ٻرڙو, بيوس محرم مغيري, پائولو ڪوئلهو, نثار احمد ناز, فھيم اختر ميمڻ, فقير يار محمد پيرزادو, سرمد کوسو, عبيد ڪٽپر, رحمت پيرزادو, آسڪر وائلڊ, عبدالحميد جتوئي, اڪبر عباسي, روڊريجو روجاس, ايوب گل, مير حاجن مير, انور احمد قاضي مورائي, جيجي درشھوار سيد, عبدالحئي سومرو, رام بخشاڻي, سيد قادر بخش شاھ بخاري, اليگزينڊر برنس, عطا محمد ڀنڀرو, جيمس مئڪمرڊو, نازش نور سومرو, ڊاڪٽر مظھر علي ڏوتيو, مختيار سمون, ڊاڪٽر عبدالرزاق گهانگهرو, خالد ڀٽي, ادريس جتوئي, سيد علي گوھر شاھ, عطا چانھيون, ڊاڪٽر عابد مظھر, نور جوڻيجو, محمد يوسف دل, انجنيئر ڊاڪٽر رياض الدين ابڙو, ڊاڪٽر محبت ٻرڙو, ڊاڪٽر عمر بن محمد دائودپوٽو, ايرڪ ڪارڊر, دوست محمد ڀٽي, ڊاڪٽر ريحانہ نظير, مولانا نظير احمد بھشتي, ساجد علي سبحاني, ايم ايڇ پنھور, عمر سومرو, ڊاڪٽر روشن گولاڻي, محمد جميل ڦلپوٽو, عطا محمد جسڪاڻي, حاڪم علي شاھہ بخاري, فرانز فينن, مقصود گل, ڊاڪٽر مھر عبدالحق سومرو, گل ڪونڌر, اڪبر لغاري, منظور سولنگي, سھيل ڀيو, غلام محمد شاھواڻي, مولانا جلال الدين رومي, غلام مصطفيٰ ناهيون, پشپا ولڀ, نصير سومرو, اختيار کوکر, تران دان تائين, مولانا محمد قاسم سومرو, علامہ غلام مصطفيٰ قاسمي, زاهد اوٺو, رشيد ڀٽي, مارڪس ۽ اينجلس, ڊاڪٽر ڊيوڊ جوزف شيوارڊز, راشد مورائي, نياز مسرور, آفتاب حسين, جيڪ ڪئن فيلڊ, وقار احمد راهمون, مخدوم محمد هاشم ٺٽوي, ڊاڪٽر عبدالرسول قادري, اشرف دھقاني, محبوب علي راھوجو, رنڌير سنگهہ, ايم اين راءِ, جيمس سي. ڊيويز, مفتي عبدالوهاب چاچڙ, غلام محمد ميمڻ, غلام محمد گلشن ڪنڌر, خليفو عبدالحڪيم, سبطِ حسن, مولانا عبيدالله سنڌي, مولانا محمد انس راڄپر, رحيم داد راهي, سيد محمد خاتمي, هاشم شورو, مومن علي شاھہ, برئم اسٽوڪر, جارج آرويل, خليل الرحمان شيخ, پيٽريڪا ميڪليگن, برٽرينڊرسل, عامر عطار, احسان "فائق" پنهور, عمر عطيلا ايرگي, مظفر بخاري, ثناءُ الله سومرو, احرار يوسف, فريڊرڪ اينگلس, احمد الدين شر, ڊاڪٽر هلوڪ نور باقي, جاويد ميمڻ, مفتي محمد ڪفايت الله دهلوي, عبدالسلام سومرو, بندو ڀٽ, ڊاڪٽر عبدالغفار سومرو, حافظ ابوالاديب سنڌي, امام غزالي, دين محمد اديب فيروز شاهي, مولانا حافظ پير ذوالفقار احمد نقشبندي مجددي, مولانا صلاح الدين سيفي, ارنيسٽ هيمنگوي, رشيد اللہ زهراڻي, نقش ناياب منگي, وسيم احمد ٽالپر, وليم شيڪسپيئر, وحيد لاشاري, جبران زيب, سعادت حسن منٽو, ليليٰ خالد, چنگيز اعتماتوف, خشونت سنگهہ, امجد ڪيريو, رفيہ ملاح, ڊاڪٽر عمر دراز خان, ڊاڪٽر امجد سراج ميمڻ, علامه سيد سليمان ندوي, عزيز منگي, ايلسا قاضي, سومار علي سومرو, محمد ياسين جروار, حسين بادشاھہ, بينظير ڀٽو, منظور مھيسر, احمد خان چانڊيو, ٽي. ڊبليو. آرنولڊ, پروفيسر شيخ محمد حاجن, انور پيرزادو, مولانا ابوالڪلام آزاد, عبدالرزاق ڊکڻ, پروفيسر محمد اسماعيل ٿيٻو, محمد بخش ٿيٻو, زان لاڪو تيور, ايشور لال سوجاڻي, ڊاڪٽر علي شريعتي, نديم گل عباسي, اسٽيفن ھاڪنگ, قاسم علي شاھہ, جان بال, اظھر آدرش, غلام نبي چنا, سنگرام, مئڪسم گورڪي, محمد حنيف صديقي, عرفان مھدي, ڊاڪٽر مبارڪ علي, پروفيسر اعجاز قريشي, آبوبڪر شيخ, مارگريٽ اِرون, نور محمد عباسي, جولس فوچڪ, نور خان, بريٽ ھيليڊي, ڊاڪٽر مظھرالدين سومرو, ڪلارڊومارڪووٽس, پي ڊبلو ائنڊريو, سومجي ڌاراڻي, پرم آنند آڏواڻي, غلام حسين رنگريز, تاج جويو, ڊاڪٽر ڦلو سندر ميگهواڙ, ڀڳوان نردوش, ھينا ھير, ٻانھون خان شيخ, نظير احمد ڀنڊ, اڪرام ساگر عباسي, سڪندر عباسي, انل بروي, ڊاڪٽر منظور قادر, جيمس برنس, سيد سجاد ترمذي, بيخود فقير صوفي القادري, افلاطون, سقراط, ڊاڪٽر گل, ھئري لورين, علي گوھر وڳڻ, اڪرم قمبراڻي, رابرٽ ڪيو ساڪي, قادر جوڻيجو, ڊاڪٽر غلام سرور ٻگهيو, سڪايل فقير غلام قاسم ڏاھري, ڄام ساقي, خادم حسين سومرو, فياض "مسافر" بروهي, صنوبر سيد, امر لغاري, مرلي ڌر, مولا بخش دلواڻي, خير محمد بلوچ, لال چند امرڏنو مل جڳتياڻي, ڊاڪٽر علي مرتضيٰ ڌاريجو, سرمد چانڊيو, خانم خديجہ دائودپوٽو, ڊاڪٽر ڄيٺو لالواڻي, ڊاڪٽر انور فگار ھڪڙو, زبير سومرو, ايف شرووڊ ٽيلر, ڀائي چين راءِ سامي, ڀوڄراج هوتچند ناگراڻي, محمد وارث عباسي, خالد حسين چنا, ارسطو, ايڇ ٽي لئمبرڪ, وليم نيپئر, ڊاڪٽر عبدالوحيد انڍڙ, انجنيئر عبدالعزيز ٻرڙو, محمد خان ابڙو, پروفيسر فدا حسين فدا, ڪيول ملڪاڻي, عبدالمؤمن ميمڻ, فيض محمد شيدي, ڊاڪٽر الھداد ٻوھيو, محمد ادريس صديقي, شمس سرڪي, سردار ٻرڙو, جي آر ھنٽر, سائر حسين, پروفيسر محرم خان وگهامل, سليم احمد, ايس آر راء, نور احمد ميمڻ, جنرل ھئگ, رائچند هريجن, مخدوم آسيہ قريشي, گل حسن ڪلمتي, سرڪش سنڌي, امتياز ابڙو, پروفيسر ڊاڪٽر ممتاز ڀٽو, ڊاڪٽر قادر مگسي, سردار ڀيو, گلاب ھَڪڙو \n\n 
            \n\n
            
            Messages: ${alternateMessages}
        `
    };


    // Get response from OpenAI API
    let openAIResponse;

    try {
        openAIResponse = await getChatCompletion({
            messages: [instructionMessage],
            user_message: null,
            model: "gpt-4-turbo"
        });

    } catch (e) {
        return "none";
    }


    console.log(openAIResponse);

    return openAIResponse;
};


const generateAlternateMessages = async ({ history, message }) => {
    if (!history || !message) {
        throw new Error("history and message is required");
    }

    const instructionMessage = {
        role: 'system',
        content: `You are a helpful assistant that generates multiple search queries based on a user query (and messages history if provided). \n
        Generate 5 search queries related to "${message}" based on user history (if provided). Each query should be separated by new lines and there should be no extra text in your response.
        If person name, book name or anything else in missing in the user message and messages history contains it, please use those missing details from chat history while creating alternate messages.
        \n\n`
    };


    // Get response from OpenAI API
    let openAIResponse;

    try {
        openAIResponse = await getChatCompletion({
            messages: [instructionMessage, ...history],
            user_message: message,
        });

    } catch (e) {
        throw new ApiResponse(500, {}, e.message);
    }


    console.log(openAIResponse.split("\n"));

    return openAIResponse.split("\n");
};

const findSimilarInformation = async ({ similar_ids, message }) => {
    try {
        // **Retrieve relevant texts from ChromaDB**
        let relevantDocs = [];
        try {
            let k = 3;
            // const similarityThreshold = 0.25; // Adjust this value based on your needs

            // let messageLength = message.split(" ").length;


            // if (messageLength < 5)
            //     k = 3  // Short query → fewer documents

            let results = null;
            if (similar_ids.length > 0) {
                results = await collection.query({
                    queryEmbeddings: await embeddingsProvider.embedQuery(message),
                    nResults: k,
                    where: { id: { "$in": similar_ids } },
                });
            } else {
                results = await collection.query({
                    queryEmbeddings: await embeddingsProvider.embedQuery(message),
                    nResults: k,
                });
            }


            relevantDocs = results.metadatas[0]
                .map((metadata, index) => {

                    // if (results.distances[0][index] > similarityThreshold) {
                    //     return null;
                    // }

                    const metadataText = Object.entries(metadata)
                        .filter(([key]) => key !== "book_id") // Exclude book_id
                        .filter(([key]) => key !== "filename") // Exclude book_id
                        .filter(([key]) => key !== "author_id") // Exclude book_id
                        .map(([key, value]) => `${key}: ${value}`)
                        .join("\n");

                    return `${metadataText}\nDocumentText: ${results.documents[0][index]}\n`;
                }).filter(Boolean);

        } catch (err) {
            console.error("Error retrieving from ChromaDB:", err);
        }

        return relevantDocs;

        // console.log(chatMessages);
    } catch (e) {
        console.log("chromadb error: " + e);
        console.log("chromadb error: " + JSON.stringify(e, null, 2));
    }

    return [];
}



async function searchByTag(searchString) {

    console.log("searchString: " + searchString);

    try {
        // Search for documents where 'searchable_tags' contains the searchString
        const results = await SiyarnoonSindhi.find(
            { searchable_tags: { $in: [searchString] } }
        ).select({ id: 1, _id: 0 });

        console.log(results);

        // Extract and return the 'id' fields
        return results.map(result => result.id);
    } catch (error) {
        console.error("Error searching for tags:", error);
        return [];
    }
}

// core logic for processing message
const processChatMessage = async ({ from, message }) => {
    if (!message) {
        throw new Error("message is required");
    }

    const instructionMessage = {
        role: 'system',
        content: `
        
        Your name is < notranslate > سياڻون سنڌي</notranslate >.
        You are not an AI, chatbot, llm, or any other type of AI.You are just < notranslate > سياڻون سنڌي</notranslate >.

        About you:
    Name: <notranslate>سياڻون سنڌي</notranslate>,
        Creator: Fahad Maqsood Qazi - Founder of Flis Technologies(فلس ٽيڪنالاجيز) - at Flis Technologies a software house in Hyderabad,
            Creator's Website: https://flistech.com/,
        Creator's Contact: https://www.flistech.com/contact.
        Languages you know: only Sindhi.
        Reason about your existence: Sindh's literacy rate is only 61% and therefore you are made to bridge knowledge gap in Sindh as you support voice messages from users and can respond in voice messages too.
    Behavior:
    1) You refuse to talk in other languages other than Sindhi.
        2) You can only do translation for words or phrases or sentences but you are not allowed to inherently speak in any other language.
        3) You shouldn't say you are not allowed to speak in another language. You should just say you can only speak in Sindhi because you only know Sindhi.
    4) You do not engage in any inappropriate or harmful behavior.
        5) Your conversation skills are playful and you use emojis somewhat moderately.
        6) You are not allowed to engage in any political or religious discussions.
        7) You are not allowed to engage in any discussions that are not suitable for children.
        8) Don't use same emojis again and again, use different emojis for different situations.

        `,
        // content: `
        // Your name is <notranslate>سياڻون سنڌي</notranslate>. You were made by Fahad Maqsood Qazi at Flis Technologies and he is its founder.
        // You are not an AI, chatbot, llm, or any other type of AI. You are just <notranslate>سياڻون سنڌي</notranslate>.
        // You will always answer in English no matter what language the user speaks.
        // Write your responses in simple english and avoid writing in a way that requires context for understanding.
        // For example: "I'm doing well, thank you! How about you?" is not a good response because How about you? requires context to understand that you are talking about yourself being fine. Good response would be "I am fine, how are you?".
        // Always write your name inside <notranslate></notranslate> tags.
        // If someone asks where you are from or where you have come from, then tell them who made you.
        // If someone says "اڇا" or "اچها" it means "really?" You have to respond with "Yes".
        // Your responses might get translated by external services therefore surround the words that should not be translated with <notranslate></notranslate> tags for example if you have  to say "An owl is called an owl in English." if this was to get translated by an external service then both instances of owl will be translated therefore to preserve context and meaning say "An owl is called an <notranslate>owl</notranslate> in English.".
        // `,

        // content: `

        // Your name is سياڻون سنڌي. You were made by Fahad Maqsood Qazi - The founder of Flis Technologies (فلس ٽيڪنالاجيز) which is a software house in Hyderabad. Their website is https://flistech.com/. People can contact them at https://www.flistech.com/contact.

        // You are not an AI, chatbot, llm, or any other type of AI. You are just سياڻون سنڌي. Sindh's literacy rate is only 61% and therefore you were made to bridge knowledge gap in Sindh. You can only speak sindhi no matter in which language the user speaks. You are only allowed to do translation for words or phrases or sentences but you are not allowed to inherently speak in any other language.

        // You speak perfect Sindhi without any grammatical mistakes. You speak standard Hyderabadi dialect of Sindhi which means you use آئون for pronoun "I" instead of مان and the word "توهان" for you (plural and for respect) instead of "اوهان".

        // If someone says "آئون ٺيڪ تون ٻڌائي", it means they are fine and they are asking you how are you? which means you shouldn't ask them again how they are.

        // **You should not make any grammatical mistakes while writing in Sindhi**
        // `,
    };

    // Fetch the last two message records from the `WhatsappMessage` table
    const recentRecords = await WhatsappMessage.find({ from: from }) // Filter by user ID or sender's phone number
        .sort({ createdAt: -1 }) // Sort by creation date in descending order
        .limit(2) // Fetch only the last two records
        .exec();

    // Separate user messages and bot replies, and prepare for OpenAI API
    const chatMessages = [];
    recentRecords.reverse().forEach((record) => {
        // Add user message
        chatMessages.push({
            role: 'user',
            content: record.text,
        });

        // Add bot reply, if exists
        if (record.botReply) {
            chatMessages.push({
                role: 'assistant',
                content: record.botReply,
            });
        }
    });

    if (!smallTalk.includes(message)) {
        const alternateMessages = await generateAlternateMessages({ history: chatMessages, message });

        console.log(`alternateMessages: ${typeof alternateMessages} ${alternateMessages}`);

        const metadataTopic = await generateMetaDataTopic({ alternateMessages, chatMessages });

        console.log(`metadataTopic: ${metadataTopic}`);

        if (metadataTopic != null && metadataTopic != "" && metadataTopic != undefined && metadataTopic != "none" && metadataTopic != "None") {

            const alternatemessagesText = alternateMessages.join("\n");

            // const relevantTags = await searchByTag(arabicToLatin(metadataTopic));
            const relevantTags = await searchByTag(metadataTopic);

            console.log("relevantTags: " + relevantTags);

            // let relevantTexts = [];
            let relevantTexts = await findSimilarInformation({ similar_ids: relevantTags, message: alternatemessagesText });

            // for (let alternateMessage of alternateMessages) {
            //     let relevantInformation = await findSimilarInformation({ metadataTopic, message: alternateMessage });

            //     console.log(`relevantInformation: ${relevantInformation}`);

            //     relevantTexts = [...relevantTexts, ...relevantInformation];
            // }

            // Add relevant text to context
            if (relevantTexts.length > 0) {
                chatMessages.push({
                    role: 'system',
                    content: `Here is some information that could be relevant to user query:\n\n${relevantTexts.join("\n\n")}`
                });
            }
        }
    }



    // Get response from OpenAI API
    let openAIResponse;

    try {
        openAIResponse = await getChatCompletion({
            messages: [instructionMessage, ...chatMessages],
            user_message: message,
        });

    } catch (e) {
        throw new ApiResponse(500, {}, e.message);
    }

    return openAIResponse;
};


// Function to delete all messages for a given sender
const deleteMessagesBySender = async ({ from }) => {
    if (!from) {
        throw new Error("Parameter 'from' is required.");
    }

    try {
        // Delete all messages with the given 'from' field
        const deleteResult = await WhatsappMessage.deleteMany({ from });

        if (deleteResult.deletedCount === 0) {
            return {
                message: `No messages found for the sender: ${from}.`,
            };
        }

        return {
            message: `${deleteResult.deletedCount} messages deleted for the sender: ${from}.`,
        };
    } catch (error) {
        throw new Error(`Failed to delete messages for the sender: ${from}. Error: ${error.message}`);
    }
};



function arabicToLatin(text) {
    text = text.replace(/[زذظض]/g, "z");
    text = text.replace(/[سصث]/g, "s");
    text = text.replace(/[تط]/g, "ẗ");
    text = text.replace(/[قڪ]/g, "k");
    text = text.replace(/[غگ]/g, "g");
    text = text.replace(/[ھهحہھ]/g, "h");
    text = text.replace(/[کخ]/g, "kh");

    return text;
}



// Your verify token
const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN;


// Your WhatsApp API credentials
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN; // Get this from Facebook Developer Dashboard
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;      // Replace with your WhatsApp phone number ID



router.post('/webhook', async (req, res) => {
    const body = req.body;

    // Log the incoming webhook event
    console.log("Webhook event received:", JSON.stringify(body, null, 2));


    // Check if this is a WhatsApp Business Account event
    if (body.object === "whatsapp_business_account") {
        body.entry.forEach((entry) => {
            entry.changes.forEach(async (change) => {
                if (change.value.messages) {
                    const messages = change.value.messages;

                    for (const message of messages) {
                        const from = message.from; // Sender's phone number
                        const text = message.text?.body; // Message text
                        const timestamp = new Date(parseInt(message.timestamp) * 1000); // Convert timestamp to Date
                        const messageId = message.id; // Unique message ID
                        const name = change.value.contacts?.[0]?.profile?.name || "Unknown"; // Sender's name

                        console.log(`Received message from ${name} (${from}): ${text}`);


                        if (text === undefined) {
                            return;
                        }

                        // Delete all messages from the sender
                        if (text == "*//delete-all-my-messages") {
                            await markMessageAsSeen(messageId);
                            await deleteMessagesBySender({ from });
                            await sendMessage(from, "done.");
                            return;
                        }

                        // translate(text, 'sd', 'en').then(async inputRes => {
                        // console.log("Input in english: " + inputRes.translation);

                        // const textEnglish = inputRes.translation;
                        const textEnglish = text;


                        await markMessageAsSeen(messageId);

                        // Generate bot reply
                        let botReply = await processChatMessage({ from: from, message: textEnglish });
                        let finalReply = botReply;

                        if (TRANSLATE_OUTPUTS) {

                            // Generate bot reply
                            botReply = botReply
                                .replace(/\s+(سياڻون سنڌي)/gi, '<notranslate>$1</notranslate>');

                            // Extract the word and replace the first tag
                            // Array to store all words/phrases inside <notranslate> tags
                            const storedWords = [];

                            // Replace all <notranslate> tags with <notranslate> and store their content
                            const outputString = botReply.replace(
                                /<notranslate>(.*?)<\/notranslate>/g, // Match ALL <notranslate> tags and their content
                                (match, content) => {
                                    storedWords.push(content); // Store the content in the array
                                    return '<<>>'; // Replace with just <notranslate>
                                }
                            );

                            console.log(storedWords); // Output: ["ڊسٽبن", "dustbin"]
                            console.log(outputString);



                            const res = await translate(outputString, 'en', 'sd');
                            console.log(res.translation);

                            const botReplySindhi = res.translation;


                            finalReply = botReplySindhi;


                            if (storedWords.length > 0) {
                                finalReply = botReplySindhi.replace(
                                    /<<>>/g, // Match all <notranslate> placeholders
                                    () => storedWords.shift() // Replace with the next stored word
                                );
                            }
                        }



                        // const botReplySindhi = botReply;
                        // console.log(`Reply in Sindhi: ${botReplySindhi}`);

                        // Save to MongoDB
                        try {
                            const newMessage = new WhatsappMessage({
                                from,
                                name,
                                messageId,
                                timestamp,
                                text,
                                textEnglish,
                                botReply,
                                botReplySindhi: finalReply,
                            });

                            await newMessage.save();
                            // console.log("Message saved to database:", newMessage);
                        } catch (error) {
                            console.error("Error saving message to database:", error.message);
                        }

                        // Send reply via WhatsApp API
                        await sendMessage(from, finalReply);



                        // }).catch(async err => {
                        //     await sendMessage(from, "اِلاهي ٽريفڪ جي ڪري مسئلا پيا اچن، بيهر ڪوشش ڪجو.");
                        // });;

                        // const res = await translate(botReply, { from: 'en', to: 'sd', client: 'gtx' });

                        // console.log(res);

                        // const botReplySindhi = res.text;
                        // console.log(`Reply in Sindhi: ${botReplySindhi}`);

                        // // Save to MongoDB
                        // try {
                        //     const newMessage = new WhatsappMessage({
                        //         from,
                        //         name,
                        //         messageId,
                        //         timestamp,
                        //         text,
                        //         botReply,
                        //         botReplySindhi,
                        //     });

                        //     await newMessage.save();
                        //     console.log("Message saved to database:", newMessage);
                        // } catch (error) {
                        //     console.error("Error saving message to database:", error.message);
                        // }

                        // // Send reply via WhatsApp API
                        // await sendMessage(from, botReplySindhi);

                    }
                }
            });
        });

        // Respond to acknowledge receipt of the event
        res.status(200).send("Event received");
    } else {
        // Respond with '404 Not Found' if the object is not as expected
        res.status(404).send("Not Found");
    }
});


// Function to send a reply via WhatsApp Cloud API
async function sendMessage(to, message) {
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

    const data = {
        messaging_product: "whatsapp",
        to: to,
        text: { body: message },
    };

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    };

    try {
        const response = await axios.post(url, data, { headers });
        console.log(`Message sent to ${to}: ${response.data}`);
    } catch (error) {
        console.error(`Failed to send message to ${to}:`, error.response?.data || error.message);
    }
}



// Function to mark a message as seen via WhatsApp Cloud API
async function markMessageAsSeen(messageId) {
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

    const data = {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,  // ID of the message to mark as read
    };

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    };

    try {
        const response = await axios.post(url, data, { headers });
        console.log(`Marked message ${messageId} as seen:`, response.data);
    } catch (error) {
        console.error(`Failed to mark message ${messageId} as seen:`, error.response?.data || error.message);
    }
}




// route to redeem a subscription code
router.get('/webhook', (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Verify the token
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified!");
        res.status(200).send(challenge); // Send back the challenge token from Facebook
    } else {
        res.status(403).send("Forbidden"); // Respond with '403 Forbidden' if token doesn't match
    }
});



export default router;
