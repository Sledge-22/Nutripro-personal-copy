import {
  initialCertificates,
  initialCommunityPosts,
  initialCourses,
  initialAssignmentSubmissions,
  initialStudentProgress,
  initialUsers,
} from "../data/mockData.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

const state = {
  users: clone(initialUsers),
  courses: clone(initialCourses),
  certificates: clone(initialCertificates),
  progress: clone(initialStudentProgress),
  communityPosts: clone(initialCommunityPosts),
  assignmentSubmissions: clone(initialAssignmentSubmissions),
};

export function getMockUsers() {
  return clone(state.users);
}

export function setMockUsers(nextUsers) {
  state.users = clone(nextUsers);
  return getMockUsers();
}

export function getMockCourses() {
  return clone(state.courses);
}

export function setMockCourses(nextCourses) {
  state.courses = clone(nextCourses);
  return getMockCourses();
}

export function getMockCertificates() {
  return clone(state.certificates);
}

export function setMockCertificates(nextCertificates) {
  state.certificates = clone(nextCertificates);
  return getMockCertificates();
}

export function getMockProgress() {
  return clone(state.progress);
}

export function setMockProgress(nextProgress) {
  state.progress = clone(nextProgress);
  return getMockProgress();
}

export function getMockCommunityPosts() {
  return clone(state.communityPosts);
}

export function setMockCommunityPosts(nextPosts) {
  state.communityPosts = clone(nextPosts);
  return getMockCommunityPosts();
}

export function getMockAssignmentSubmissions() {
  return clone(state.assignmentSubmissions);
}

export function setMockAssignmentSubmissions(nextSubmissions) {
  state.assignmentSubmissions = clone(nextSubmissions);
  return getMockAssignmentSubmissions();
}

export function createMockId(items) {
  return nextId(items);
}

export function cloneMockValue(value) {
  return clone(value);
}
