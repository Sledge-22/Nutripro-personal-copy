// TODO(database): Replace these in-memory users with database-backed users.
export const initialUsers = [
  { id: 1, name: "Maya Laurent", email: "maya@nutripro.demo", status: "Active", role: "Student", country: "Argentina", bio: "Fanática del rendimiento y la nutrición deportiva.", profile_picture_url: "" },
  { id: 2, name: "Noah Williams", email: "noah@nutripro.demo", status: "Paused", role: "Student", country: "Canada", bio: "", profile_picture_url: "" },
  { id: 3, name: "Emma Chen", email: "emma@nutripro.demo", status: "Inactive", role: "Student", country: "Spain", bio: "", profile_picture_url: "" },
  { id: 4, name: "Alex Morgan", email: "admin@nutripro.demo", status: "Active", role: "Admin", country: "United States", bio: "", profile_picture_url: "" },
];

// TODO(database): Replace these mock course and module records with database-backed courses and modules.
// TODO(database): Replace mock PDF labels with real upload/storage metadata.
// TODO(database): Replace mock video labels and links with real upload/storage metadata.
export const initialCourses = [
  {
    id: 1,
    title: "Nutrition Foundations",
    description: "Build a practical understanding of nutrients, balanced meals, and everyday food choices.",
    status: "published",
    image_url: "",
    owners: [1, 2],
    modules: [
      {
        id: 11,
        title: "The building blocks",
        description: "Start with the core nutrient groups and how they work together.",
        requires_assignment: false,
        pdfLabel: "building-blocks.pdf",
        video: {
          id: 111,
          title: "The building blocks video",
          description: "A clear walkthrough of carbohydrates, protein, and fats in everyday meals.",
          duration: "12 min",
          link: "https://nutripro.demo/video/macronutrients",
          uploadLabel: "building-blocks.mp4",
        },
      },
      {
        id: 12,
        title: "Nutrition in practice",
        description: "Apply nutrition basics to labels, habits, and meal structure.",
        requires_assignment: false,
        pdfLabel: "nutrition-in-practice.pdf",
        video: {
          id: 121,
          title: "Nutrition in practice video",
          description: "Learn how to scan a label for serving size, fibre, protein, and added sugars.",
          duration: "10 min",
          link: "https://nutripro.demo/video/labels",
          uploadLabel: "nutrition-in-practice.mp4",
        },
      },
    ],
  },
  {
    id: 2,
    title: "Healthy Meal Planning",
    description: "Turn nutrition principles into a simple weekly meal-planning routine.",
    status: "published",
    image_url: "",
    owners: [1],
    modules: [
      {
        id: 21,
        title: "Planning your week",
        description: "Set up a practical structure for meals across the week.",
        requires_assignment: true,
        pdfLabel: "planning-your-week.pdf",
        video: {
          id: 211,
          title: "Planning your week video",
          description: "A weekly planning approach designed to stay realistic and easy to reuse.",
          duration: "14 min",
          link: "https://nutripro.demo/video/flexible-plan",
          uploadLabel: "planning-your-week.mp4",
        },
      },
      {
        id: 22,
        title: "Making it work",
        description: "Carry your plan into shopping and daily routines.",
        pdfLabel: "making-it-work.pdf",
        video: {
          id: 221,
          title: "Making it work video",
          description: "Turn your weekly plan into a shopping list that supports your routine.",
          duration: "11 min",
          link: "https://nutripro.demo/video/shopping-plan",
          uploadLabel: "making-it-work.mp4",
        },
      },
    ],
  },
  {
    id: 3,
    title: "Mindful Eating Essentials",
    description: "Learn practical techniques for more attentive and intentional eating.",
    status: "published",
    image_url: "",
    owners: [2, 3],
    modules: [
      {
        id: 31,
        title: "Mindful foundations",
        description: "Build awareness around cues, habits, and pacing.",
        requires_assignment: false,
        pdfLabel: "mindful-foundations.pdf",
        video: {
          id: 311,
          title: "Mindful foundations video",
          description: "Understand internal signals and how they can guide eating decisions.",
          duration: "13 min",
          link: "https://nutripro.demo/video/cues",
          uploadLabel: "mindful-foundations.mp4",
        },
      },
    ],
  },
];

// TODO(database): Replace these mock certificates with certificate records from the database.
export const initialCertificates = [
  { id: 1, studentId: 1, student: "Maya Laurent", courseId: 1, course: "Nutrition Foundations", number: "NP-2026-1042", issueDate: "18 Jun 2026", status: "Issued" },
  { id: 2, studentId: 2, student: "Noah Williams", courseId: 3, course: "Mindful Eating Essentials", number: "NP-2026-1038", issueDate: "12 Jun 2026", status: "Issued" },
];

// TODO(database): Replace this mock student progress with persisted student progress records.
export const initialStudentProgress = {
  "pdf-11": true,
  "video-11": true,
  "module-11": true,
  "pdf-12": true,
  "video-12": true,
  "module-12": true,
  "pdf-21": true,
  "video-21": true,
  "module-21": true,
};

// TODO(database): Replace these mock community posts with database-backed community posts.
export const initialCommunityPosts = [
  {
    id: 1,
    studentId: 9001,
    author: "Alex Morgan",
    authorRole: "admin",
    initials: "AM",
    country: "Spain",
    title: "Bienvenido a la comunidad de Nutripro",
    body: "Usa este espacio para hacer preguntas, compartir recursos y conversar sobre cursos, entrenamiento y nutrición deportiva.",
    category: "announcement",
    isPinned: true,
    upvoteCount: 6,
    upvoterIds: ["2", "3", "4", "5", "6", "7"],
    createdAt: "2026-07-10T09:00:00.000Z",
    comments: [],
  },
  {
    id: 2,
    studentId: 2,
    author: "Maya Laurent",
    authorRole: "student",
    initials: "ML",
    country: "Argentina",
    title: "¿Cómo debo controlar la hidratación durante el entrenamiento?",
    body: "Estoy probando sesiones más largas y quiero una forma simple de revisar si estoy hidratándome bien antes, durante y después.",
    category: "question",
    upvoteCount: 4,
    upvoterIds: ["1", "3", "4", "5"],
    createdAt: "2026-07-12T13:20:00.000Z",
    comments: [
      {
        id: 201,
        postId: 2,
        studentId: 1,
        author: "Alex Morgan",
        authorRole: "admin",
        initials: "AM",
        body: "Una buena base es controlar tu peso antes y después de la sesión y revisar el color de la orina junto con tu sensación de energía.",
        isHelpfulAnswer: true,
        createdAt: "2026-07-12T14:00:00.000Z",
      },
    ],
  },
  {
    id: 3,
    studentId: 3,
    author: "Emma Chen",
    authorRole: "student",
    initials: "EC",
    country: "Spain",
    title: "Ideas para comer antes del entrenamiento",
    body: "Me funcionó mucho preparar un snack simple con carbohidratos fáciles de digerir 60–90 minutos antes. ¿Qué están usando ustedes?",
    category: "discussion",
    upvoteCount: 3,
    upvoterIds: ["1", "2", "4"],
    createdAt: "2026-07-11T18:00:00.000Z",
    comments: [],
  },
];

// TODO(database): Replace these mock assignment submissions with database-backed assignment submission records.
export const initialAssignmentSubmissions = [];
