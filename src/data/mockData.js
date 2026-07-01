// TODO(database): Replace these in-memory users with database-backed users.
export const initialUsers = [
  { id: 1, name: "Maya Laurent", email: "maya@nutripro.demo", status: "Active", role: "Student" },
  { id: 2, name: "Noah Williams", email: "noah@nutripro.demo", status: "Paused", role: "Student" },
  { id: 3, name: "Emma Chen", email: "emma@nutripro.demo", status: "Inactive", role: "Student" },
  { id: 4, name: "Alex Morgan", email: "admin@nutripro.demo", status: "Active", role: "Admin" },
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
    owners: [1, 2],
    modules: [
      {
        id: 11,
        title: "The building blocks",
        description: "Start with the core nutrient groups and how they work together.",
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
    owners: [1],
    modules: [
      {
        id: 21,
        title: "Planning your week",
        description: "Set up a practical structure for meals across the week.",
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
    owners: [2, 3],
    modules: [
      {
        id: 31,
        title: "Mindful foundations",
        description: "Build awareness around cues, habits, and pacing.",
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
  { id: 1, author: "Noah Williams", initials: "NW", time: "2 hours ago", title: "A meal-planning habit that finally stuck", body: "Planning just three dinners first made the whole week feel much easier. What small change worked for you?" },
  { id: 2, author: "Emma Chen", initials: "EC", time: "Yesterday", title: "Reading labels without overthinking it", body: "I started checking serving size and fibre first. The Nutrition Foundations module made the process much clearer." },
];

// TODO(database): Replace these mock assignment submissions with database-backed assignment submission records.
export const initialAssignmentSubmissions = [];
